package main

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
)

// visor-exec is wired on every boot -- wireVisorExec runs unconditionally and 28
// routes are registered under /visor-exec -- and its repository writes six
// relations. No migration ever created them, so every endpoint died with
//   pq: relation "visor_exec_command_logs" does not exist
// before a line of business logic could run. That failure is invisible to go
// build and to go vet, so the tests below derive the required table and column
// set out of the Go source: adding a column to a statement fails the suite
// until the migration catches up.

var (
	// reVisorExecTable names every visor_exec_ relation mentioned in source.
	reVisorExecTable = regexp.MustCompile(`visor_exec_[a-z_]+`)
	// reVisorExecCreate accepts both "CREATE TABLE" and "CREATE TABLE IF NOT
	// EXISTS" and captures the parenthesised column block, which is what the
	// column check below is run against. Limiting the capture to one table's
	// own block keeps a sibling table's identically named column from
	// satisfying it.
	reVisorExecCreate = regexp.MustCompile(`(?s)CREATE TABLE(?:\s+IF NOT EXISTS)? (visor_exec_[a-z_]+) \(([^;]+?)\);`)
	reVisorExecDrop   = regexp.MustCompile(`DROP TABLE(?:\s+IF EXISTS)? (visor_exec_[a-z_]+)`)
	// reVisorExecInsert is anchored on a single-line column list, the shape every
	// statement in the repository uses.
	reVisorExecInsert = regexp.MustCompile(`INSERT INTO (visor_exec_[a-z_]+) \(([^)\n]+)\)`)
	// reVisorExecUpdate spans both the back-quoted literals and the
	// double-quoted fmt.Sprintf forms; stopping at the first WHERE keeps the
	// WHERE columns out of the captured group. It is a double-quoted Go string
	// because a backtick inside a raw literal would end it.
	reVisorExecUpdate = regexp.MustCompile("UPDATE (visor_exec_[a-z_]+) SET ([^\"`]+?) WHERE")
	// reSetColumn is the left-hand side of one SET assignment, bound to a
	// positional placeholder or to NOW().
	reSetColumn = regexp.MustCompile(`(\w+)\s*=\s*(?:\$\d+|NOW\(\))`)
	// reUpdateWhitelist reads the two []string whitelist literals out of the
	// repository instead of restating them here, so a renamed variable fails.
	reUpdateWhitelist = regexp.MustCompile(`(templateUpdatable|cronUpdatable)\s*=\s*\[\]string\{([^}]*)\}`)
	reQuoted          = regexp.MustCompile(`"([^"]+)"`)
	// reServiceUpdate is one updates["col"] assignment in the service layer.
	reServiceUpdate = regexp.MustCompile(`updates\["([a-z_]+)"\]`)
)

func sortedSetKeys[V any](m map[string]V) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// Every relation the module names must be created by exactly one forward
// migration. Zero creators is the defect this round closed; more than one means
// two migrations write the same relation and the second one silently overwrites
// the first.
func TestMigrationsCreateTheVisorExecTables(t *testing.T) {
	referenced := map[string]string{}
	err := filepath.WalkDir("../../internal/visor-exec", func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		b, rerr := os.ReadFile(path)
		if rerr != nil {
			return nil
		}
		for _, tbl := range reVisorExecTable.FindAllString(string(b), -1) {
			if _, ok := referenced[tbl]; !ok {
				referenced[tbl] = filepath.ToSlash(path)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walk visor-exec: %v", err)
	}
	if len(referenced) == 0 {
		t.Skip("no Go code references a visor_exec table")
	}

	creators := map[string][]string{}
	ddlFiles := map[string]bool{}
	versions := map[string][]string{}
	for _, e := range entriesInMigrationsDir() {
		// Rollbacks run only on an explicit MIGRATE_DOWN_TO and would drop the
		// tables; the invariant is about the forward path.
		if strings.HasSuffix(e.name, "_down.sql") {
			continue
		}
		if n, err := strconv.Atoi(e.name[:3]); err == nil && n > 0 {
			versions[e.name[:3]] = append(versions[e.name[:3]], e.name)
		}
		created := reVisorExecCreate.FindAllStringSubmatch(e.body, -1)
		if len(created) == 0 {
			continue
		}
		ddlFiles[e.name] = true
		// The runner wraps each file in its own transaction, so a literal
		// BEGIN/COMMIT would end that transaction early and the later statements
		// would run without a rollback on error.
		if reLiteralTx.MatchString(e.body) {
			t.Errorf("%s contains a literal BEGIN or COMMIT; the runner wraps each file in its own transaction", e.name)
		}
		for _, m := range created {
			creators[m[1]] = append(creators[m[1]], e.name)
		}
	}

	// The runner reads the flat directory in version order, so a duplicated
	// version would apply two files at the same step.
	for _, v := range sortedKeys(versions) {
		if len(versions[v]) > 1 {
			t.Errorf("migration version %s is used by %d files: %v", v, len(versions[v]), versions[v])
		}
	}

	for _, tbl := range sortedSetKeys(referenced) {
		switch len(creators[tbl]) {
		case 0:
			t.Errorf("%s is referenced in %s but no forward migration creates it", tbl, referenced[tbl])
		case 1:
			t.Logf("%s is created by %s", tbl, creators[tbl][0])
		default:
			t.Errorf("%s is created by %d migrations: %v", tbl, len(creators[tbl]), creators[tbl])
		}
	}

	// The migration runner applies a file only if it contains a statement, so a
	// file named for visor_exec that creates nothing is a no-op worth catching.
	for name := range ddlFiles {
		if !strings.Contains(name, "visor_exec") {
			continue
		}
		if reVisorExecCreate.FindAllStringSubmatch(readMigration(name), -1) == nil {
			t.Errorf("%s names visor_exec but creates no visor_exec table", name)
		}
	}
}

func readMigration(name string) string {
	b, err := os.ReadFile(filepath.Join("../../migrations", name))
	if err != nil {
		return ""
	}
	return string(b)
}

// Every column the repository inserts, updates, or puts on an update whitelist
// must exist in the DDL. sqlx's NamedExecContext refuses a column the table
// does not declare, so a mismatch here is a runtime failure, not a compile
// error.
func TestMigrationColumnsCoverEveryVisorExecStatement(t *testing.T) {
	repo, err := os.ReadFile("../../internal/visor-exec/repository/repository.go")
	if err != nil {
		t.Fatalf("read repository: %v", err)
	}
	src := string(repo)

	ddl := map[string]string{}
	for _, e := range entriesInMigrationsDir() {
		if strings.HasSuffix(e.name, "_down.sql") {
			continue
		}
		for _, m := range reVisorExecCreate.FindAllStringSubmatch(e.body, -1) {
			ddl[m[1]] += "\n" + m[2]
		}
	}

	// required[table][column] records where the requirement came from, so a
	// failure message says whether the column was named in an INSERT, an UPDATE
	// or a whitelist.
	required := map[string]map[string]string{}
	add := func(table, col, origin string) {
		if table == "" || col == "" {
			return
		}
		if required[table] == nil {
			required[table] = map[string]string{}
		}
		required[table][col] = origin
	}
	for _, m := range reVisorExecInsert.FindAllStringSubmatch(src, -1) {
		for _, col := range strings.Split(m[2], ",") {
			add(m[1], strings.TrimSpace(col), "INSERT")
		}
	}
	for _, m := range reVisorExecUpdate.FindAllStringSubmatch(src, -1) {
		for _, c := range reSetColumn.FindAllStringSubmatch(m[2], -1) {
			add(m[1], c[1], "UPDATE SET")
		}
	}
	whitelistTable := map[string]string{
		"templateUpdatable": "visor_exec_templates",
		"cronUpdatable":     "visor_exec_cron_jobs",
	}
	for _, m := range reUpdateWhitelist.FindAllStringSubmatch(src, -1) {
		for _, c := range reQuoted.FindAllStringSubmatch(m[2], -1) {
			add(whitelistTable[m[1]], c[1], "whitelist "+m[1])
		}
	}

	if len(required) == 0 {
		t.Fatal("no visor_exec statement was found in the repository")
	}
	for _, tbl := range sortedSetKeys(required) {
		body, ok := ddl[tbl]
		if !ok {
			t.Errorf("%s is written by the repository but no forward migration creates it", tbl)
			continue
		}
		for _, col := range sortedSetKeys(setOf(required[tbl])) {
			if !reColumnInDDL(col).MatchString(body) {
				t.Errorf("%s uses column %s (%s) but no CREATE TABLE for %s defines it",
					tbl, col, required[tbl][col], tbl)
			}
		}
	}
}

func setOf(m map[string]string) map[string]bool {
	out := map[string]bool{}
	for k := range m {
		out[k] = true
	}
	return out
}

// The service builds updates[...] maps from the request body and the repository
// turns them into SET clauses. A field the service can send that the whitelist
// does not list now answers 500 instead of silently rewriting nothing -- still a
// defect, and this test is what reports it.
func TestVisorExecUpdateWhitelistsMatchTheService(t *testing.T) {
	svc, err := os.ReadFile("../../internal/visor-exec/service/service.go")
	if err != nil {
		t.Fatalf("read service: %v", err)
	}
	repo, err := os.ReadFile("../../internal/visor-exec/repository/repository.go")
	if err != nil {
		t.Fatalf("read repository: %v", err)
	}

	// Attribute each updates["col"] to the function that builds it, so a key
	// sent to the wrong table cannot pass.
	split := strings.Index(string(svc), "func (s *Service) UpdateCronJob(")
	if split < 0 {
		t.Fatal("service has no UpdateCronJob")
	}
	want := map[string]map[string]bool{"templateUpdatable": {}, "cronUpdatable": {}}
	for _, m := range reServiceUpdate.FindAllStringSubmatch(string(svc[:split]), -1) {
		want["templateUpdatable"][m[1]] = true
	}
	for _, m := range reServiceUpdate.FindAllStringSubmatch(string(svc[split:]), -1) {
		want["cronUpdatable"][m[1]] = true
	}
	if len(want["templateUpdatable"]) == 0 || len(want["cronUpdatable"]) == 0 {
		t.Fatal("no updates[...] map was found in the service")
	}

	got := map[string]map[string]bool{}
	for _, m := range reUpdateWhitelist.FindAllStringSubmatch(string(repo), -1) {
		got[m[1]] = map[string]bool{}
		for _, c := range reQuoted.FindAllStringSubmatch(m[2], -1) {
			got[m[1]][c[1]] = true
		}
	}

	for _, name := range []string{"templateUpdatable", "cronUpdatable"} {
		for _, col := range sortedSetKeys(want[name]) {
			if !got[name][col] {
				t.Errorf("the service can send %q to %s but the repository whitelist %s does not allow it",
					col, name, name)
			}
		}
		for _, col := range sortedSetKeys(got[name]) {
			if !want[name][col] {
				t.Errorf("the repository whitelist %s allows %q but the service never sends it", name, col)
			}
		}
	}
}

// A forward migration that creates a table must have a rollback that drops it,
// otherwise MIGRATE_DOWN_TO leaves an orphaned relation the next migration
// cannot reuse.
func TestVisorExecDownMigrationDropsEveryTableItCreated(t *testing.T) {
	var up, down strings.Builder
	for _, e := range entriesInMigrationsDir() {
		if !strings.Contains(e.name, "visor_exec") {
			continue
		}
		if strings.HasSuffix(e.name, "_down.sql") {
			down.WriteString("\n")
			down.WriteString(e.body)
			continue
		}
		up.WriteString("\n")
		up.WriteString(e.body)
	}

	created := map[string]bool{}
	for _, m := range reVisorExecCreate.FindAllStringSubmatch(up.String(), -1) {
		created[m[1]] = true
	}
	dropped := map[string]bool{}
	for _, m := range reVisorExecDrop.FindAllStringSubmatch(down.String(), -1) {
		dropped[m[1]] = true
	}
	if len(created) == 0 {
		t.Skip("no forward migration creates a visor_exec table")
	}
	for _, tbl := range sortedSetKeys(created) {
		if !dropped[tbl] {
			t.Errorf("the forward migration creates %s but no down migration drops it", tbl)
		}
	}
}
