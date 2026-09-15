package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// The policy module is wired on every boot and its handler registers 26 routes,
// but no migration created the relation its repository names. Migration 060
// creates policies, policy_evaluations, policy_violations, policy_overrides,
// policy_bundles and policy_exemptions; the repository reads policy_definitions
// for every definition method, so all of the /policies routes failed at the SQL
// layer with `pq: relation "policy_definitions" does not exist` before any
// business logic could run.
//
// Migration 592 creates the relation the repository actually names. 060's
// `policies` is not renamed: migration 239 casts its tenant_id to UUID, 570 adds
// fk_policies_tenant and fk_policies_user, and 572 adds created_by and
// updated_by, so shadowing it would leave those migrations altering an empty
// relation. These tests derive the column, placeholder, index and tenant-scoping
// sets out of the Go source so a db tag, a statement and a migration cannot
// drift apart again. Every identifier here is prefixed with pol so nothing
// collides with the cfg, dr, runbook and scan helpers in this package.

const polMigration = "592_create_policy_definitions.sql"
const polDownMigration = "592_create_policy_definitions_down.sql"
const polLegacyMigration = "060_create_policy_tables.sql"

var (
	rePolRel    = regexp.MustCompile(`(?i)(?:FROM|INTO|UPDATE)\s+(policy_[a-z0-9_]*)`)
	rePolCreate = regexp.MustCompile(
		`(?s)CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(policy_definitions)\s*\(([^;]+?)\);`)
	// rePolAnyCreate is used only for the legacy migration, whose tables do not
	// all carry the policy_definitions name.
	rePolAnyCreate   = regexp.MustCompile(`(?i)CREATE TABLE(?:\s+IF NOT EXISTS)?\s+([a-z0-9_]+)\s*\(`)
	rePolInsert      = regexp.MustCompile(`(?s)INSERT INTO (policy_definitions)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)`)
	rePolCreateIndex = regexp.MustCompile(`(?i)CREATE INDEX IF NOT EXISTS ([a-z0-9_]+)\s+ON\s+(policy_definitions)\s*\(([^)]+)\)`)
	rePolDropIndex   = regexp.MustCompile(`(?i)DROP INDEX IF EXISTS "?([a-z0-9_]+)"?`)
	rePolDropTable   = regexp.MustCompile(`(?i)DROP TABLE IF EXISTS (policy_definitions)`)
	rePolRename      = regexp.MustCompile(`(?i)ALTER TABLE\s+([a-z0-9_]+)\s+RENAME`)
	rePolNamed       = regexp.MustCompile(`:(\w+)`)
	rePolQuestion    = regexp.MustCompile(`\?`)
	rePolDBTag       = regexp.MustCompile("db:\"([a-z0-9_]+)\"")
	rePolNotNull     = regexp.MustCompile(`(?i)\bNOT NULL\b`)
	rePolDefault     = regexp.MustCompile(`(?i)\bDEFAULT\b`)
	rePolColDecl     = regexp.MustCompile(`^\s*([a-z_0-9]+)\s+([A-Za-z]+(?:\s*\(?\d*\)?))?(.*)$`)
	// rePolAlterAdd pins the invariant that nothing after 592 may widen the
	// table. policy_definitions is read with SELECT *, so a column added later
	// would make every scan fail in exactly the way 571's deleted_at broke the
	// chatops readers.
	rePolAlterAdd = regexp.MustCompile(`(?i)ALTER TABLE\s+policy_definitions\b[^\n]*ADD`)
)

// polFile pairs a source path with its content so a failure can name the file.
type polFile struct{ name, body string }

func polSourceFiles(t *testing.T) []polFile {
	t.Helper()
	var out []polFile
	err := filepath.WalkDir("../../internal/policy", func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		b, rerr := os.ReadFile(path)
		if rerr != nil {
			return nil
		}
		out = append(out, polFile{name: path, body: string(b)})
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(out) == 0 {
		t.Fatal("no policy source file was found")
	}
	return out
}

func polReadRepo(t *testing.T) string {
	t.Helper()
	b, err := os.ReadFile("../../internal/policy/repository/repository.go")
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

// polModelTags pulls the db tags out of models.go, struct by struct.
func polModelTags(t *testing.T) map[string][]string {
	t.Helper()
	b, err := os.ReadFile("../../internal/policy/models/models.go")
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
		if m := rePolDBTag.FindStringSubmatch(line); m != nil {
			tags[cur] = append(tags[cur], m[1])
		}
	}
	return tags
}

// polSchema returns, per table, the declared columns and the NOT NULL columns
// that carry no default. Everything comes from migration 592 alone.
func polSchema(t *testing.T) (map[string][]string, map[string][]string) {
	t.Helper()
	body := migrationBody(t, polMigration)
	declared := map[string][]string{}
	noDefault := map[string][]string{}
	for _, m := range rePolCreate.FindAllStringSubmatch(body, -1) {
		table, block := m[1], m[2]
		for _, raw := range strings.Split(block, "\n") {
			line := strings.TrimSpace(raw)
			if line == "" || strings.HasPrefix(line, "--") {
				continue
			}
			cm := rePolColDecl.FindStringSubmatch(line)
			if cm == nil {
				continue
			}
			declared[table] = append(declared[table], cm[1])
			if rePolNotNull.MatchString(cm[3]) && !rePolDefault.MatchString(cm[3]) {
				noDefault[table] = append(noDefault[table], cm[1])
			}
		}
	}
	return declared, noDefault
}

// Every relation the module's SQL names must be created by exactly one forward
// migration. Zero creators is the break this round closed; two means a later
// migration silently redefines what an earlier one promised.
func TestPolicyMigrationsCreateEveryRelationTheModuleNames(t *testing.T) {
	want := map[string]bool{}
	for _, f := range polSourceFiles(t) {
		for _, m := range rePolRel.FindAllStringSubmatch(f.body, -1) {
			want[m[1]] = true
		}
	}
	if len(want) == 0 {
		t.Fatal("no policy relation was found in the module source")
	}
	if !want["policy_definitions"] {
		t.Fatalf("the repository no longer names policy_definitions; the relation %s creates is orphaned", polMigration)
	}

	creators := map[string][]string{}
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range rePolAnyCreate.FindAllStringSubmatch(f.body, -1) {
			if strings.HasPrefix(m[1], "policy") {
				creators[m[1]] = append(creators[m[1]], f.name)
			}
		}
	}
	for table := range want {
		switch n := len(creators[table]); {
		case n == 0:
			t.Errorf("relation %q is referenced by the module but no migration creates it", table)
		case n > 1:
			t.Errorf("relation %q is created by %d migrations: %v", table, n, creators[table])
		}
	}

	// 592 must own policy_definitions and nothing else. A second table here
	// would be an accidental shadow of a relation another migration owns.
	owned := map[string]bool{}
	for _, m := range rePolCreate.FindAllStringSubmatch(migrationBody(t, polMigration), -1) {
		owned[m[1]] = true
	}
	if len(owned) != 1 || !owned["policy_definitions"] {
		t.Errorf("%s must create exactly policy_definitions, it creates %v", polMigration, owned)
	}
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		if f.name <= polMigration {
			continue
		}
		if n := len(rePolCreate.FindAllStringSubmatch(f.body, -1)); n > 0 {
			t.Errorf("%s also creates policy_definitions, a second definition of the relation", f.name)
		}
	}
}

// policy_definitions is read with SELECT *, so the migration's column set and
// models.Policy's db tags must agree in both directions. An extra column in the
// migration fails the scan into a struct that has no field for it; a column the
// migration omits fails the scan in the other direction.
func TestPolicyDefinitionsMatchesThePolicyModelExactly(t *testing.T) {
	tags := polModelTags(t)
	raw, ok := tags["Policy"]
	if !ok {
		t.Fatal("models.Policy has no db tags")
	}
	declared, _ := polSchema(t)
	decl, ok := declared["policy_definitions"]
	if !ok {
		t.Fatalf("%s does not declare policy_definitions", polMigration)
	}
	if len(raw) != len(decl) {
		t.Errorf("models.Policy has %d db tags but policy_definitions declares %d columns", len(raw), len(decl))
	}
	have := map[string]bool{}
	for _, c := range raw {
		have[c] = true
	}
	for _, c := range raw {
		if !containsStr(decl, c) {
			t.Errorf("models.Policy has db tag %q but policy_definitions does not declare it, so the scan would fail", c)
		}
	}
	for _, c := range decl {
		if !have[c] {
			t.Errorf("policy_definitions declares %q but models.Policy has no field for it, so SELECT * would fail", c)
		}
	}
}

// The invariant above is only true while nothing later widens the table. A
// retrofit that adds deleted_at or audit columns to policy_definitions would
// break every policy read without changing any Go file, so it must be loud.
func TestPolicyDefinitionsGainsNoColumnAfterItsCreation(t *testing.T) {
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		if n := len(rePolAlterAdd.FindAllStringSubmatch(f.body, -1)); n > 0 {
			t.Errorf("%s adds a column to policy_definitions, which %s creates; every SELECT * into models.Policy would fail from then on",
				f.name, polMigration)
		}
	}
}

// The repository uses named placeholders in its INSERT, so sqlx matches them
// against the db tag values verbatim. A placeholder spelled :tenantId would
// compile fine and fail at runtime on the first POST /policies.
func TestPolicyInsertPlaceholdersMatchThePolicyModelTags(t *testing.T) {
	tags := polModelTags(t)
	raw, ok := tags["Policy"]
	if !ok {
		t.Fatal("models.Policy has no db tags")
	}
	have := map[string]bool{}
	for _, c := range raw {
		have[c] = true
	}

	found := false
	for _, f := range polSourceFiles(t) {
		for _, m := range rePolInsert.FindAllStringSubmatch(f.body, -1) {
			found = true
			named := map[string]bool{}
			for _, p := range rePolNamed.FindAllStringSubmatch(m[3], -1) {
				named[p[1]] = true
			}
			if len(named) != len(raw) {
				t.Errorf("the policy_definitions INSERT binds %d placeholders but models.Policy has %d db tags",
					len(named), len(raw))
				continue
			}
			for p := range named {
				if !have[p] {
					t.Errorf("the INSERT binds :%s but models.Policy has no db tag %q", p, p)
				}
			}
			for _, c := range raw {
				if !named[c] {
					t.Errorf("the INSERT omits :%s, so policy_definitions.%s would be written with no value", c, c)
				}
			}
		}
	}
	if !found {
		t.Error("no INSERT INTO policy_definitions was found")
	}
}

// The NOT NULL constraint is what keeps a NULL out of models.Policy: every Go
// string field would fail the scan on a NULL column, so the column must be
// NOT NULL. 592 also gives description and rego a DEFAULT of the empty string,
// and that default is deliberately not pinned here. It is not load-bearing --
// NOT NULL already forbids the NULL, and the repository's single INSERT supplies
// both columns, which this test asserts. The default only decides what an
// omitted column does: with it, an INSERT that forgets description stores the
// empty string silently; without it, the NOT NULL violation fails loudly. That
// is the stricter behaviour, so the mutation was recorded rather than tested.
func TestPolicyNotNullColumnsAreSuppliedByTheInsert(t *testing.T) {
	_, noDefault := polSchema(t)
	checked := false
	for _, f := range polSourceFiles(t) {
		for _, m := range rePolInsert.FindAllStringSubmatch(f.body, -1) {
			checked = true
			supplied := map[string]bool{}
			for _, c := range strings.Split(m[2], ",") {
				supplied[strings.TrimSpace(c)] = true
			}
			for _, col := range noDefault[m[1]] {
				if !supplied[col] {
					t.Errorf("%s.%s is NOT NULL with no default but the INSERT omits it, so the insert fails",
						m[1], col)
				}
			}
		}
	}
	if !checked {
		t.Error("no INSERT INTO policy_definitions was found")
	}
}

func TestPolicyDownDropsEveryForwardObject(t *testing.T) {
	fwd := migrationBody(t, polMigration)
	down := migrationBody(t, polDownMigration)

	idx := map[string]bool{}
	for _, m := range rePolCreateIndex.FindAllStringSubmatch(fwd, -1) {
		idx[m[1]] = true
	}
	dropped := map[string]bool{}
	for _, m := range rePolDropIndex.FindAllStringSubmatch(down, -1) {
		dropped[m[1]] = true
	}
	if len(idx) != len(dropped) {
		t.Errorf("forward creates %d indexes, down drops %d", len(idx), len(dropped))
	}
	for name := range idx {
		if !dropped[name] {
			t.Errorf("index %s is created by %s but never dropped", name, polMigration)
		}
	}
	for name := range dropped {
		if !idx[name] {
			t.Errorf("index %s is dropped by %s but never created", name, polDownMigration)
		}
	}

	tabs := map[string]bool{}
	for _, m := range rePolCreate.FindAllStringSubmatch(fwd, -1) {
		tabs[m[1]] = true
	}
	droppedTabs := map[string]bool{}
	for _, m := range rePolDropTable.FindAllStringSubmatch(down, -1) {
		droppedTabs[m[1]] = true
	}
	if len(tabs) != len(droppedTabs) {
		t.Errorf("forward creates %d tables, down drops %d", len(tabs), len(droppedTabs))
	}
	for tab := range tabs {
		if !droppedTabs[tab] {
			t.Errorf("table %s is created by %s but never dropped", tab, polMigration)
		}
	}
	for tab := range droppedTabs {
		if !tabs[tab] {
			t.Errorf("table %s is dropped by %s but never created", tab, polDownMigration)
		}
	}
}

// 060's six tables are the relations later migrations own: 239 casts
// policies.tenant_id to UUID, 570 adds fk_policies_tenant and fk_policies_user,
// and 572 adds created_by and updated_by. Renaming policies to
// policy_definitions would leave those migrations altering an empty relation, so
// the shadow this round chose is 592 creating the right name instead of moving
// the old one.
func TestPolicyLegacyMigration060StillOwnsItsRelations(t *testing.T) {
	got := map[string]bool{}
	for _, m := range rePolAnyCreate.FindAllStringSubmatch(migrationBody(t, polLegacyMigration), -1) {
		if strings.HasPrefix(m[1], "policy") || m[1] == "policies" {
			got[m[1]] = true
		}
	}
	if len(got) != 6 {
		t.Errorf("%s creates %d policy relations, the recorded set holds 6: %v", polLegacyMigration, len(got), got)
	}
	if !got["policies"] {
		t.Errorf("%s no longer creates policies, so the relation 592 deliberately did not rename has moved",
			polLegacyMigration)
	}

	// No migration may rename either name; a rename would silently detach the
	// later ALTERs from the relation the repository reads.
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range rePolRename.FindAllStringSubmatch(f.body, -1) {
			if m[1] == "policies" || m[1] == "policy_definitions" {
				t.Errorf("%s renames %s, which 592's shadowing decision depends on", f.name, m[1])
			}
		}
	}

	// The module must not query the legacy name either; two CREATE TABLEs in the
	// source tree must not both describe a relation the code reads.
	referenced := map[string]bool{}
	for _, f := range polSourceFiles(t) {
		for _, m := range rePolRel.FindAllStringSubmatch(f.body, -1) {
			referenced[m[1]] = true
		}
	}
	if referenced["policies"] {
		t.Error("the module queries policies, which 060 creates, while 592 creates policy_definitions")
	}
}

func TestPolicyDefinitionsIndexesTargetDeclaredColumns(t *testing.T) {
	declared, _ := polSchema(t)
	decl := declared["policy_definitions"]
	if len(decl) == 0 {
		t.Fatalf("%s declares no columns", polMigration)
	}
	body := migrationBody(t, polMigration)
	if len(rePolCreateIndex.FindAllStringSubmatch(body, -1)) == 0 {
		t.Errorf("%s creates no index", polMigration)
	}
	tenantIndexed := false
	for _, m := range rePolCreateIndex.FindAllStringSubmatch(body, -1) {
		name, cols := m[1], strings.TrimSpace(m[3])
		col := strings.TrimSpace(strings.Split(cols, ",")[0])
		col = strings.TrimSpace(strings.SplitN(col, " ", 2)[0])
		if !containsStr(decl, col) {
			t.Errorf("index %s sorts on a column %s does not declare: %s", name, polMigration, col)
		}
		if col == "tenant_id" {
			tenantIndexed = true
		}
	}
	if !tenantIndexed {
		t.Errorf("policy_definitions has no tenant_id index, so a cross-tenant scan has to read every row")
	}
}

// ListPolicies is the only policy reader that sorts, and it sorts by
// created_at DESC, which is the query the third index exists to serve.
func TestPolicyDefinitionsHasAnIndexForTheSortedList(t *testing.T) {
	declared, _ := polSchema(t)
	src := polReadRepo(t)
	sortAt := ""
	for i, line := range strings.Split(src, "\n") {
		trim := strings.TrimSpace(line)
		if strings.HasPrefix(trim, "--") {
			continue
		}
		if strings.Contains(trim, "ORDER BY created_at DESC") && strings.Contains(trim, "policy_definitions") {
			sortAt = fmtLine(i+1, trim)
		}
	}
	if sortAt == "" {
		t.Error("no policy_definitions statement sorts by created_at DESC, so the sort index has no query")
		return
	}
	body := migrationBody(t, polMigration)
	if !strings.Contains(strings.ToLower(body), "created_at desc") &&
		!strings.Contains(strings.ToLower(body), "created_at DESC") {
		t.Errorf("policy_definitions has no created_at index for the sort at %s", sortAt)
	}
	if !containsStr(declared["policy_definitions"], "created_at") {
		t.Errorf("policy_definitions does not declare created_at but the repository sorts by it")
	}
}

func fmtLine(n int, s string) string {
	return "line " + strings.TrimSpace(s)
}

func TestPolicyRepositoryUsesPostgresPlaceholdersOnly(t *testing.T) {
	for _, f := range polSourceFiles(t) {
		for i, line := range strings.Split(f.body, "\n") {
			trim := strings.TrimSpace(line)
			if strings.HasPrefix(trim, "//") {
				continue
			}
			if rePolQuestion.MatchString(line) {
				t.Errorf("%s line %d uses a MySQL style placeholder: %s", f.name, i+1, trim)
			}
		}
	}
}

// Every statement against a policy relation must carry a tenant_id predicate.
// The unit is a statement, not a source line: UpdatePolicy writes its WHERE
// clause on the second line of its raw literal, so a line-level check would
// report the method that carries the Round 50 bindvar bug as unscoped.
// ListExemptions builds its WHERE clause from a slice that is joined into the
// Sprintf template, so the template has no tenant_id and the conds slice holds
// it; dropping tenant_id from conds would read every tenant's exemptions.
func TestPolicyEveryStatementIsTenantScoped(t *testing.T) {
	reRel := regexp.MustCompile(`(?i)(?:FROM|INTO|UPDATE)\s+(policy_[a-z0-9_]*)`)
	found := map[string]bool{}
	for _, f := range polSourceFiles(t) {
		for _, stmt := range polStatements(f.body) {
			for _, m := range reRel.FindAllStringSubmatch(stmt, -1) {
				table := m[1]
				found[table] = true
				if strings.Contains(stmt, "tenant_id") {
					continue
				}
				if table == "policy_exemptions" && strings.Contains(f.body, "tenant_id=$1") {
					continue // ListExemptions: the predicate lives in the conds slice
				}
				t.Errorf("%s references %s without a tenant_id predicate: %s", f.name, table, polOneLine(stmt))
			}
		}
	}
	for _, want := range []string{"policy_definitions", "policy_evaluations", "policy_violations",
		"policy_overrides", "policy_bundles", "policy_exemptions"} {
		if !found[want] {
			t.Errorf("no statement against %s was found in the module source", want)
		}
	}
}

// polStatements returns every string literal that carries SQL: backtick raw
// literals and quoted literals. The quoted branch is what reaches the
// fmt.Sprintf template in ListExemptions; without it that method's SELECT would
// be invisible to the tenant check.
func polStatements(src string) []string {
	reBack := regexp.MustCompile("`([^`]+)")
	reQuote := regexp.MustCompile(`"([^"\\]*(?:\\.[^"\\]*)*)"`)
	out := []string{}
	for _, m := range reBack.FindAllStringSubmatch(src, -1) {
		out = append(out, m[1])
	}
	for _, m := range reQuote.FindAllStringSubmatch(src, -1) {
		out = append(out, m[1])
	}
	return out
}

func polOneLine(s string) string {
	return strings.Join(strings.Fields(s), " ")
}
