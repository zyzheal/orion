package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
)

// The dr module is wired on every boot -- wireBlueprintInfraOps builds the
// repository, service and handler unconditionally -- and its repository issues
// statements against four relations. No migration ever created any of them, so
// all 25 registered endpoints failed at the SQL layer with
// "pq: relation dr_plans does not exist". Migration 589 closes that gap, and
// these tests derive the required relation, column and nullability sets out of
// the Go source so a statement, a db tag and a migration cannot drift apart
// again. Every identifier is prefixed with dr so nothing here collides with the
// shared helpers in this package.

const drMigration = "589_create_dr_tables.sql"
const drDownMigration = "589_create_dr_tables_down.sql"

var (
	// reDrRel names every relation the module SQL mentions. Every dr relation is
	// prefixed with dr_, which keeps English prose in comments out of the set.
	reDrRel    = regexp.MustCompile(`(?i)(?:FROM|INTO|UPDATE)\s+(dr_[a-z0-9_]*)`)
	reDrCreate = regexp.MustCompile(
		`(?s)CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(dr_[a-z0-9_]*)\s*\(([^;]+?)\);`)
	reDrInsert = regexp.MustCompile(
		`(?s)INSERT INTO (dr_[a-z0-9_]*)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)`)
	reDrCreateIndex = regexp.MustCompile(`(?i)CREATE INDEX IF NOT EXISTS ([a-z0-9_]+)\s+ON\s+(dr_[a-z0-9_]*)`)
	reDrDropIndex   = regexp.MustCompile(`(?i)DROP INDEX IF EXISTS "?([a-z0-9_]+)"?`)
	reDrDropTable   = regexp.MustCompile(`(?i)DROP TABLE IF EXISTS (dr_[a-z0-9_]*)`)
	reDrPlaceholder = regexp.MustCompile(`\$(\d+)`)
	reDrQuestion    = regexp.MustCompile(`\?`)
	// reDrSelectStar is checked line by line and comment lines are skipped, so a
	// discussion of the SELECT * policy in a comment does not fail the check.
	reDrSelectStar = regexp.MustCompile(`(?i)\bSELECT\s+\*`)
	reDrReturnStar = regexp.MustCompile(`(?i)\bRETURNING\s+\*`)
	reDrDBTag      = regexp.MustCompile("`db:\"([a-z0-9_]+)\"")
	reDrQuote      = regexp.MustCompile(`"([^"]*)"`)
	reDrNotNull    = regexp.MustCompile(`(?i)\bNOT NULL\b`)
	reDrDefault    = regexp.MustCompile(`(?i)\bDEFAULT\b`)
	// reDrColDecl matches a column declaration anywhere in a CREATE TABLE block.
	// The type is matched loosely on purpose: a strict type list is what made the
	// older shared helper silently drop BIGINT, INTEGER and DECIMAL columns.
	reDrColDecl = regexp.MustCompile(`^\s*([a-z_0-9]+)\s+([A-Za-z]+(?:\s*\(?\d*\)?))?(.*)$`)
)

// structToTable pins the four row structs to the relations the repository scans
// them into. Deriving this mapping from source would be circular.
var drStructToTable = map[string]string{
	"DRPlan":       "dr_plans",
	"FailoverTest": "dr_failover_tests",
	"BackupConfig": "dr_backup_configs",
	"DRPolicy":     "dr_policies",
}

// drConstToTable names the SELECT/RETURNING column lists in the repository.
var drConstToTable = map[string]string{
	"planColumns":         "dr_plans",
	"failoverTestColumns": "dr_failover_tests",
	"backupConfigColumns": "dr_backup_configs",
	"policyColumns":       "dr_policies",
}

func drSourceFiles(t *testing.T) []string {
	t.Helper()
	var out []string
	err := filepath.WalkDir("../../internal/infrastructure/dr", func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		b, rerr := os.ReadFile(path)
		if rerr != nil {
			return nil
		}
		out = append(out, string(b))
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return out
}

func drReadRepo(t *testing.T) string {
	t.Helper()
	b, err := os.ReadFile("../../internal/infrastructure/dr/repository/dr_repository.go")
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func drModelTags(t *testing.T) map[string][]string {
	t.Helper()
	b, err := os.ReadFile("../../internal/infrastructure/dr/models/models.go")
	if err != nil {
		t.Fatalf("models.go: %v", err)
	}
	tags := map[string][]string{}
	cur := ""
	for _, line := range strings.Split(string(b), "\n") {
		trim := strings.TrimSpace(line)
		if strings.HasPrefix(trim, "type ") && strings.HasSuffix(trim, "struct {") {
			cur = strings.TrimSpace(strings.TrimSuffix(
				strings.TrimPrefix(trim, "type "), "struct {"))
			continue
		}
		if cur == "" {
			continue
		}
		if trim == "}" {
			cur = ""
			continue
		}
		if m := reDrDBTag.FindStringSubmatch(line); m != nil {
			tags[cur] = append(tags[cur], m[1])
		}
	}
	return tags
}

// drSchema returns, per table, the declared column set and the NOT NULL columns
// that carry no default. Everything comes from migration 589 alone.
func drSchema(t *testing.T) (map[string][]string, map[string][]string) {
	t.Helper()
	body := migrationBody(t, drMigration)
	declared := map[string][]string{}
	noDefault := map[string][]string{}
	for _, m := range reDrCreate.FindAllStringSubmatch(body, -1) {
		table, block := m[1], m[2]
		for _, raw := range strings.Split(block, "\n") {
			line := strings.TrimSpace(raw)
			if line == "" || strings.HasPrefix(line, "--") {
				continue
			}
			cm := reDrColDecl.FindStringSubmatch(line)
			if cm == nil {
				continue
			}
			declared[table] = append(declared[table], cm[1])
			if reDrNotNull.MatchString(cm[3]) && !reDrDefault.MatchString(cm[3]) {
				noDefault[table] = append(noDefault[table], cm[1])
			}
		}
	}
	return declared, noDefault
}

// drConstColumns reads the column list a const holds by concatenating the
// quoted fragments the declaration spans. The list is never restated here, so a
// truncated const is caught rather than copied.
func drConstColumns(t *testing.T, name string) []string {
	t.Helper()
	src := drReadRepo(t)
	header := regexp.MustCompile(`(?m)^\s*const\s+` + regexp.QuoteMeta(name) + `\s+=`)
	lines := strings.Split(src, "\n")
	start := -1
	for i, l := range lines {
		if header.MatchString(l) {
			start = i
			break
		}
	}
	if start < 0 {
		t.Fatalf("const %s not found in dr_repository.go", name)
	}
	chunk := []string{lines[start]}
	for _, l := range lines[start+1:] {
		if strings.HasPrefix(l, "\t") {
			chunk = append(chunk, l)
			continue
		}
		break
	}
	var cols []string
	for _, frag := range reDrQuote.FindAllStringSubmatch(strings.Join(chunk, "\n"), -1) {
		for _, c := range strings.Split(frag[1], ",") {
			c = strings.TrimSpace(c)
			if c != "" {
				cols = append(cols, c)
			}
		}
	}
	return cols
}

func TestDrMigrationsCreateEveryRelation(t *testing.T) {
	want := map[string]bool{}
	for _, src := range drSourceFiles(t) {
		for _, m := range reDrRel.FindAllStringSubmatch(src, -1) {
			want[m[1]] = true
		}
	}
	if len(want) == 0 {
		t.Fatal("no dr relation was found in the module source")
	}

	creators := map[string][]string{}
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range reDrCreate.FindAllStringSubmatch(f.body, -1) {
			creators[m[1]] = append(creators[m[1]], f.name)
		}
	}
	for table := range want {
		switch n := len(creators[table]); {
		case n == 0:
			t.Errorf("relation %q is referenced by the dr module but no migration creates it", table)
		case n > 1:
			t.Errorf("relation %q is created by %d migrations: %v", table, n, creators[table])
		}
	}
	if len(creators) != len(want) {
		t.Errorf("the forward migrations create %d dr relations but the module references %d",
			len(creators), len(want))
	}
}

func TestDrColumnConstsCoverEveryMigrationColumn(t *testing.T) {
	declared, _ := drSchema(t)
	src := drReadRepo(t)
	for constName, table := range drConstToTable {
		cols := drConstColumns(t, constName)
		have := map[string]bool{}
		for _, c := range cols {
			have[c] = true
		}
		wantCols := declared[table]
		if len(cols) != len(wantCols) {
			t.Errorf("%s lists %d columns but %s declares %d", constName, len(cols), table, len(wantCols))
		}
		for _, c := range cols {
			if !containsStr(wantCols, c) {
				t.Errorf("%s selects %q but %s does not declare that column", constName, c, table)
			}
		}
		for _, c := range wantCols {
			if !have[c] {
				t.Errorf("%s declares column %q but %s never selects it, so the read would drop it",
					table, c, constName)
			}
		}
		// The const must back both a SELECT and an UPDATE RETURNING list.
		if strings.Count(src, "+"+constName+"+")+strings.Count(src, constName+")") < 2 {
			t.Errorf("%s is not referenced by both a SELECT and a RETURNING", constName)
		}
	}
}

func TestDrMigrationMatchesModelTags(t *testing.T) {
	tags := drModelTags(t)
	declared, _ := drSchema(t)
	for structName, table := range drStructToTable {
		cols, ok := tags[structName]
		if !ok {
			t.Fatalf("struct %s has no db tags", structName)
		}
		have := map[string]bool{}
		for _, c := range cols {
			have[c] = true
		}
		want := map[string]bool{}
		for _, c := range declared[table] {
			want[c] = true
		}
		if len(cols) != len(want) {
			t.Errorf("%s declares %d db tags but %s has %d columns", structName, len(cols), table, len(want))
		}
		for c := range have {
			if !want[c] {
				t.Errorf("%s has db tag %q but %s does not declare that column", structName, c, table)
			}
		}
		for c := range want {
			if !have[c] {
				t.Errorf("%s declares column %q but %s has no db tag for it, so the scan would fail",
					table, c, structName)
			}
		}
	}
}

func TestDrNotNullColumnsAreSuppliedByInserts(t *testing.T) {
	_, noDefault := drSchema(t)
	checked := map[string]bool{}
	for _, src := range drSourceFiles(t) {
		for _, m := range reDrInsert.FindAllStringSubmatch(src, -1) {
			table, colList := m[1], m[2]
			checked[table] = true
			supplied := map[string]bool{}
			for _, c := range strings.Split(colList, ",") {
				supplied[strings.TrimSpace(c)] = true
			}
			for _, col := range noDefault[table] {
				if !supplied[col] {
					t.Errorf("%s.%s is NOT NULL with no default but the %s INSERT omits it",
						table, col, table)
				}
			}
		}
	}
	for _, table := range drStructToTable {
		if !checked[table] {
			t.Errorf("no INSERT INTO %s was found in the module source", table)
		}
	}
}

func TestDrInsertPlaceholdersAreContiguousAndComplete(t *testing.T) {
	declared, _ := drSchema(t)
	for _, src := range drSourceFiles(t) {
		for _, m := range reDrInsert.FindAllStringSubmatch(src, -1) {
			table, colList, valList := m[1], m[2], m[3]
			nCols := len(strings.Split(colList, ","))
			seen := map[int]bool{}
			for _, p := range reDrPlaceholder.FindAllStringSubmatch(valList, -1) {
				n, err := strconv.Atoi(p[1])
				if err != nil || n < 1 {
					t.Fatalf("%s INSERT has a bad placeholder %q", table, p[1])
				}
				seen[n] = true
			}
			if len(seen) != nCols {
				t.Errorf("%s INSERT has %d columns but %d placeholders", table, nCols, len(seen))
			}
			for i := 1; i <= len(seen); i++ {
				if !seen[i] {
					t.Errorf("%s INSERT is missing placeholder $%d", table, i)
				}
			}
			if _, ok := declared[table]; !ok {
				t.Errorf("%s INSERT has no CREATE TABLE in %s", table, drMigration)
			}
		}
	}
}

func TestDrRepositoryUsesPostgresPlaceholdersOnly(t *testing.T) {
	src := drReadRepo(t)
	for i, line := range strings.Split(src, "\n") {
		trim := strings.TrimSpace(line)
		if strings.HasPrefix(trim, "//") {
			continue
		}
		if reDrQuestion.MatchString(line) {
			t.Errorf("line %d uses a MySQL style placeholder: %s", i+1, trim)
		}
		if reDrSelectStar.MatchString(line) || reDrReturnStar.MatchString(line) {
			t.Errorf("line %d uses a wildcard select: %s", i+1, trim)
		}
	}
}

func TestDrDownDropsEveryForwardObject(t *testing.T) {
	fwd := migrationBody(t, drMigration)
	down := migrationBody(t, drDownMigration)

	idx := map[string]bool{}
	for _, m := range reDrCreateIndex.FindAllStringSubmatch(fwd, -1) {
		idx[m[1]] = true
	}
	dropped := map[string]bool{}
	for _, m := range reDrDropIndex.FindAllStringSubmatch(down, -1) {
		dropped[m[1]] = true
	}
	if len(idx) != len(dropped) {
		t.Errorf("forward creates %d indexes, down drops %d", len(idx), len(dropped))
	}
	for name := range idx {
		if !dropped[name] {
			t.Errorf("index %s is created by %s but never dropped", name, drMigration)
		}
	}
	for name := range dropped {
		if !idx[name] {
			t.Errorf("index %s is dropped by %s but never created", name, drDownMigration)
		}
	}

	tabs := map[string]bool{}
	for _, m := range reDrCreate.FindAllStringSubmatch(fwd, -1) {
		tabs[m[1]] = true
	}
	droppedTabs := map[string]bool{}
	for _, m := range reDrDropTable.FindAllStringSubmatch(down, -1) {
		droppedTabs[m[1]] = true
	}
	if len(tabs) != len(droppedTabs) {
		t.Errorf("forward creates %d tables, down drops %d", len(tabs), len(droppedTabs))
	}
	for tab := range tabs {
		if !droppedTabs[tab] {
			t.Errorf("table %s is created by %s but never dropped", tab, drMigration)
		}
	}

	// The down file must drop tables in the reverse order of creation so a
	// rollback cannot leave a table whose indexes are already gone.
	order := []string{}
	for _, m := range reDrDropTable.FindAllStringSubmatch(down, -1) {
		order = append(order, m[1])
	}
	created := []string{}
	for _, m := range reDrCreate.FindAllStringSubmatch(fwd, -1) {
		created = append(created, m[1])
	}
	if strings.Join(order, ",") != strings.Join(reverseDr(created), ",") {
		t.Errorf("down drops %v but forward creates %v", order, created)
	}
}

func TestDrEveryTableGetsAtLeastOneTenantIndex(t *testing.T) {
	body := migrationBody(t, drMigration)
	created := map[string]bool{}
	for _, m := range reDrCreate.FindAllStringSubmatch(body, -1) {
		created[m[1]] = true
	}
	indexed := map[string]bool{}
	for _, m := range reDrCreateIndex.FindAllStringSubmatch(body, -1) {
		if !created[m[2]] {
			t.Errorf("index %s targets %s, which %s does not create", m[1], m[2], drMigration)
		}
		indexed[m[2]] = true
	}
	for table := range created {
		if !indexed[table] {
			t.Errorf("table %s has no index, so every read scans it", table)
		}
	}
}

func containsStr(in []string, want string) bool {
	for _, s := range in {
		if s == want {
			return true
		}
	}
	return false
}

func reverseDr(in []string) []string {
	out := make([]string, len(in))
	for i, v := range in {
		out[len(in)-1-i] = v
	}
	return out
}
