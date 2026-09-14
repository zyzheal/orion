package main

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// The tenant-quota module is wired on every boot -- wireTenantQuota runs
// unconditionally and thirteen routes are registered under /tenant-quota -- and
// it writes three relations that 398_create_tenant_quota.sql does create.
// Before this round all fourteen statements used MySQL ? placeholders against a
// postgres driver, and the four Phase 306 policy columns the service writes had
// no migration at all, so every policy update died with
//   pq: column "soft_limit" of relation "tenant_quota_plan" does not exist
// 588_add_tenant_quota_plan_policy.sql supplies the columns. The checks below
// derive the required relation and column set out of the Go source so a
// statement and a migration can never drift apart again.

var (
	// reTQRel names every relation the module's SQL mentions. All three are
	// prefixed tenant_quota_, which keeps English prose out of the set. The
	// trailing boundary is mandatory: 570, 571 and 572 address the plural
	// tenant_quota_alerts and tenant_quotas inside guarded DO blocks, and
	// reading those as tenant_quota_alert would claim columns the module never
	// receives -- every one of those blocks is a silent no-op, because the
	// information_schema.tables probe returns no row for a plural name that
	// 398 never created.
	reTQRel = regexp.MustCompile(`(?i)(?:FROM|INTO|UPDATE|TABLE(?:\s+IF NOT EXISTS)?)\s+(tenant_quota_plan|tenant_quota_usage|tenant_quota_alert)([^a-z0-9_]|$)`)
	// reTQInsert is anchored on each INSERT's column list. The plan one spans
	// six lines, so the character class must cross newlines.
	reTQInsert = regexp.MustCompile(`(?s)INSERT INTO (tenant_quota_plan|tenant_quota_usage|tenant_quota_alert)\s*\(([^)]+)\)`)
	// reTQCreate captures one table's own parenthesised block, so a sibling
	// table's identically named column cannot satisfy a check on this one.
	reTQCreate     = regexp.MustCompile(`(?s)CREATE TABLE(?:\s+IF NOT EXISTS)? (tenant_quota_plan|tenant_quota_usage|tenant_quota_alert)\s*\(([^;]+?)\);`)
	reTQAddColumn  = regexp.MustCompile(`(?i)ALTER TABLE (tenant_quota_plan|tenant_quota_usage|tenant_quota_alert) ADD COLUMN(?:\s+IF NOT EXISTS)? (\w+)\s+([^;]+);`)
	reTQDropColumn = regexp.MustCompile(`(?i)ALTER TABLE (tenant_quota_plan) DROP COLUMN IF EXISTS (\w+)`)
	// A NOT NULL declaration that also carries a DEFAULT is satisfiable by
	// leaving the column out of an INSERT, so the default is tracked separately
	// from the NOT NULL. The shared reNotNullColumn omits BIGINT, INT, DECIMAL
	// and bare TIMESTAMP -- 398 uses all four and 588 uses two of them.
	reTQNotNullColumn = regexp.MustCompile(`(?i)^\s*(\w+)\s+(?:VARCHAR\(\d+\)|TEXT|JSONB|BOOLEAN|UUID|INT(?:EGER)?|BIGINT|DECIMAL\(\d+,\d+\)|TIMESTAMP(?:\s+WITH TIME ZONE)?|TIMESTAMPTZ)\s+NOT NULL`)
	reTQDefault       = regexp.MustCompile(`(?i)^\s*(\w+)\s+[^,]*\bDEFAULT\b`)
	// The three column-list consts and the update whitelist are read out of the
	// source rather than restated here, so a renamed or shortened list fails
	// instead of going unnoticed.
	reTQColumnsConst = regexp.MustCompile("(planColumns|usageColumns|alertColumns)\\s*=\\s*`([^`]+)`")
	reTQUpdatable    = regexp.MustCompile(`planUpdatable\s*=\s*\[\]string\{([^}]*)\}`)
)

func tenantSourceFiles(t *testing.T) []migrationFile {
	t.Helper()
	var out []migrationFile
	err := filepath.WalkDir("../../internal/tenant-quota", func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		b, rerr := os.ReadFile(path)
		if rerr != nil {
			return nil
		}
		out = append(out, migrationFile{name: path, body: string(b)})
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return out
}

// tqSchema is the accumulated shape of the three relations after every forward
// migration has run, in file order.
type tqSchema struct {
	declared    map[string]map[string]bool // table -> column
	createdCols map[string]map[string]bool // table -> column at CREATE time only
	notNull     map[string]map[string]bool
	defaults    map[string]map[string]bool
	created     map[string]string // table -> creating migration
	addedBy     map[string]string // table.column -> adding migration
}

func loadTQSchema() tqSchema {
	s := tqSchema{
		declared:    map[string]map[string]bool{},
		createdCols: map[string]map[string]bool{},
		notNull:     map[string]map[string]bool{},
		defaults:    map[string]map[string]bool{},
		created:     map[string]string{},
		addedBy:     map[string]string{},
	}
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range reTQCreate.FindAllStringSubmatch(f.body, -1) {
			table, block := m[1], m[2]
			s.created[table] = f.name
			notNullOr(s.declared, table)
			notNullOr(s.createdCols, table)
			notNullOr(s.notNull, table)
			notNullOr(s.defaults, table)
			for _, col := range splitDDLColumns(block) {
				s.declared[table][col] = true
				s.createdCols[table][col] = true
			}
			// NOT NULL and DEFAULT can sit on different lines of one
			// declaration, so both are read from the raw block.
			for _, line := range strings.Split(block, "\n") {
				if c := reTQNotNullColumn.FindStringSubmatch(line); c != nil {
					s.notNull[table][c[1]] = true
				}
				if d := reTQDefault.FindStringSubmatch(line); d != nil {
					s.defaults[table][d[1]] = true
				}
			}
		}
		for _, m := range reTQAddColumn.FindAllStringSubmatch(f.body, -1) {
			col, typ := m[2], strings.ToUpper(strings.TrimSpace(m[3]))
			notNullOr(s.declared, m[1])[col] = true
			s.addedBy[m[1]+"."+col] = f.name
			if strings.Contains(typ, "NOT NULL") {
				notNullOr(s.notNull, m[1])[col] = true
			}
			if strings.Contains(typ, "DEFAULT") {
				notNullOr(s.defaults, m[1])[col] = true
			}
		}
	}
	return s
}

var tqPolicyColumns = []string{"soft_limit", "hard_limit", "over_limit_action", "warn_thresholds"}

// Every relation the module's SQL mentions must be created by exactly one
// forward migration.
func TestMigrationsCreateEveryTenantQuotaRelation(t *testing.T) {
	want := map[string]bool{}
	for _, src := range tenantSourceFiles(t) {
		for _, m := range reTQRel.FindAllStringSubmatch(src.body, -1) {
			want[m[1]] = true
		}
	}
	wantRels := []string{"tenant_quota_plan", "tenant_quota_usage", "tenant_quota_alert"}
	for _, rel := range wantRels {
		if !want[rel] {
			t.Fatalf("expected %s to be referenced by the module source, found %v", rel, sortedSetKeys(want))
		}
	}
	if len(want) != 3 {
		t.Fatalf("expected the three tenant_quota relations, found %d: %v", len(want), sortedSetKeys(want))
	}

	creators := map[string][]string{}
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range reTQCreate.FindAllStringSubmatch(f.body, -1) {
			creators[m[1]] = append(creators[m[1]], f.name)
		}
	}
	for _, rel := range wantRels {
		if got := creators[rel]; len(got) != 1 || got[0] != "398_create_tenant_quota.sql" {
			t.Errorf("%s is created by %v, want 398_create_tenant_quota.sql", rel, creators[rel])
		}
	}
}

// The accumulated schema must admit every INSERT the repository issues: each
// column it names has to be declared, and every NOT NULL column it leaves out
// has to have a default. The four policy columns are the subject of the round,
// so they must exist now and must not have existed already.
func TestTenantQuotaStatementsFitTheMigratedSchema(t *testing.T) {
	s := loadTQSchema()

	inserted := map[string][]string{}
	for _, src := range tenantSourceFiles(t) {
		for _, m := range reTQInsert.FindAllStringSubmatch(src.body, -1) {
			cols := strings.Split(m[2], ",")
			for i := range cols {
				cols[i] = strings.TrimSpace(cols[i])
			}
			inserted[m[1]] = cols
		}
	}
	wantCols := map[string]int{"tenant_quota_plan": 20, "tenant_quota_usage": 9, "tenant_quota_alert": 8}
	for table, n := range wantCols {
		if len(inserted[table]) != n {
			t.Errorf("%s INSERT names %d columns, want %d: %v", table, len(inserted[table]), n, inserted[table])
		}
	}
	for table, cols := range inserted {
		supplied := map[string]bool{}
		for _, c := range cols {
			supplied[c] = true
			if !s.declared[table][c] {
				t.Errorf("%s: column %q is INSERTed but no migration declares it", table, c)
			}
		}
		var missing []string
		for c := range s.notNull[table] {
			if !supplied[c] && !s.defaults[table][c] {
				missing = append(missing, c)
			}
		}
		sort.Strings(missing)
		if len(missing) > 0 {
			t.Errorf("%s: NOT NULL columns %v are neither INSERTed nor defaulted", table, missing)
		}
	}

	if len(s.addedBy) != 4 {
		t.Fatalf("588 adds %d columns, want 4: %v", len(s.addedBy), sortedSetKeys(s.addedBy))
	}
	for _, col := range tqPolicyColumns {
		key := "tenant_quota_plan." + col
		if got := s.addedBy[key]; got != "588_add_tenant_quota_plan_policy.sql" {
			t.Errorf("%s is added by %q, want 588_add_tenant_quota_plan_policy.sql", key, got)
		}
		if !s.declared["tenant_quota_plan"][col] {
			t.Errorf("%s is not in the accumulated tenant_quota_plan schema", col)
		}
		// 588 must be the migration that closed the gap. If 398 had already
		// declared the column, 588 would be a no-op and the pre-R43 statements
		// were never schema-broken.
		if s.createdCols["tenant_quota_plan"][col] {
			t.Errorf("%s already existed in 398, so 588 would be a no-op", col)
		}
	}
}

// The three SELECT lists must be set-equal to the columns 398 plus 588 declare.
// Set equality is the guard that matters: 398 alone would make the list short
// by four, and a column 588 adds later must appear in the list, because safe-
// mode sqlx fails the whole read the moment a SELECT * would return a column no
// struct field declares. planUpdatable is checked the same way -- it is the set
// a caller may write, so a column it names but the schema lacks is a 500.
func TestTenantQuotaColumnListsMatchTheMigratedSchema(t *testing.T) {
	s := loadTQSchema()
	src := strings.Join(bodiesOf(tenantSourceFiles(t)), "\n")

	matches := reTQColumnsConst.FindAllStringSubmatch(src, -1)
	if len(matches) != 3 {
		t.Fatalf("expected three column-list consts, found %d", len(matches))
	}
	relOf := map[string]string{
		"planColumns":  "tenant_quota_plan",
		"usageColumns": "tenant_quota_usage",
		"alertColumns": "tenant_quota_alert",
	}
	seen := map[string]bool{}
	for _, m := range matches {
		name, list := m[1], m[2]
		seen[name] = true
		table, ok := relOf[name]
		if !ok {
			t.Fatalf("unexpected column-list const %q", name)
		}
		got := map[string]bool{}
		for _, raw := range strings.Split(list, ",") {
			col := strings.TrimSpace(raw)
			if col == "" {
				continue
			}
			if !s.declared[table][col] {
				t.Errorf("%s selects %s of %s, which no migration declares", name, col, table)
			}
			got[col] = true
		}
		for col := range s.declared[table] {
			if !got[col] {
				t.Errorf("%s omits %s, which %s declares", name, col, table)
			}
		}
		if len(got) != len(s.declared[table]) {
			t.Errorf("%s lists %d of the %d %s columns: %v", name, len(got), len(s.declared[table]), table, sortedSetKeys(s.declared[table]))
		}
	}
	for _, name := range []string{"planColumns", "usageColumns", "alertColumns"} {
		if !seen[name] {
			t.Errorf("the %s column list was not found", name)
		}
	}

	if m := reTQUpdatable.FindStringSubmatch(src); m == nil {
		t.Fatal("the planUpdatable whitelist was not found")
	} else {
		for _, raw := range strings.Split(m[1], ",") {
			col := strings.Trim(strings.TrimSpace(raw), "\"' ")
			if col == "" {
				continue
			}
			if !s.declared["tenant_quota_plan"][col] {
				t.Errorf("planUpdatable allows %s, which no migration declares", col)
			}
		}
	}

	// The check skips comment lines: the planColumns doc says "explicit rather
	// than SELECT *", and that prose is not a statement. A SELECT * on a real
	// code line still fails here.
	for _, f := range tenantSourceFiles(t) {
		for i, line := range strings.Split(f.body, "\n") {
			if strings.HasPrefix(strings.TrimSpace(line), "//") {
				continue
			}
			if strings.Contains(strings.ToUpper(line), "SELECT *") {
				t.Errorf("%s still uses SELECT * at line %d: %s", f.name, i+1, strings.TrimSpace(line))
			}
		}
	}
}

// The driver is postgres via lib/pq, which rejects a MySQL ? placeholder before
// any repository code runs. Numbered $n placeholders are the only form lib/pq
// accepts, so the absence of ? and the presence of real $n statements are both
// pinned here.
func TestTenantQuotaSQLUsesDollarPlaceholders(t *testing.T) {
	files := tenantSourceFiles(t)
	for _, f := range files {
		for i, line := range strings.Split(f.body, "\n") {
			if strings.HasPrefix(strings.TrimSpace(line), "//") {
				continue
			}
			if strings.Contains(line, "?") {
				t.Errorf("%s uses a MySQL ? placeholder at line %d: %s", f.name, i+1, strings.TrimSpace(line))
			}
		}
	}
	src := strings.Join(bodiesOf(files), "\n")
	for _, want := range []string{
		"WHERE id = $1 AND tenant_id = $2",
		"WHERE tenant_id = $1 ORDER BY created_at DESC",
		"WHERE tenant_id = $1 AND metric = $2 ORDER BY window_start DESC LIMIT 1",
		"WHERE tenant_id = $7 AND metric = $8",
	} {
		if !strings.Contains(src, want) {
			t.Errorf("the repository no longer issues %q", want)
		}
	}
}

// The down migration must drop every column 588 adds and nothing else, and every
// added column must be NOT NULL with a default so an existing plan keeps a
// coherent "no policy configured" row.
func TestMigration588DownReversesItsForwardStatements(t *testing.T) {
	up := migrationBody(t, "588_add_tenant_quota_plan_policy.sql")
	dn := migrationBody(t, "588_add_tenant_quota_plan_policy_down.sql")

	added := map[string]string{}
	for _, m := range reTQAddColumn.FindAllStringSubmatch(up, -1) {
		added[m[2]] = strings.TrimSpace(m[3])
	}
	if len(added) != 4 {
		t.Fatalf("588 adds %d columns, want 4: %v", len(added), sortedSetKeys(added))
	}
	for _, col := range tqPolicyColumns {
		if _, ok := added[col]; !ok {
			t.Errorf("588 does not add %s: %v", col, sortedSetKeys(added))
		}
	}
	for col, typ := range added {
		typUpper := strings.ToUpper(typ)
		if !strings.Contains(typUpper, "NOT NULL") || !strings.Contains(typUpper, "DEFAULT") {
			t.Errorf("%s is %s, want NOT NULL with a DEFAULT so an existing plan keeps its value", col, typ)
		}
	}
	if !strings.Contains(strings.ToUpper(added["warn_thresholds"]), "VARCHAR(255)") {
		t.Errorf("warn_thresholds is %s, want VARCHAR(255): a shorter type truncates a three-entry list", added["warn_thresholds"])
	}

	dropped := map[string]bool{}
	for _, m := range reTQDropColumn.FindAllStringSubmatch(dn, -1) {
		// Group 1 is the table, group 2 the column.
		dropped[m[2]] = true
	}
	for col := range added {
		if !dropped[col] {
			t.Errorf("588 adds %s but the down migration never drops it", col)
		}
	}
	if len(dropped) != len(added) {
		t.Errorf("the down migration drops %d columns, want %d: %v", len(dropped), len(added), sortedSetKeys(dropped))
	}
	if n := len(reLiteralTx.FindAllString(up, -1)); n != 0 {
		t.Errorf("588 contains %d literal transaction statements, which would end the runner's transaction", n)
	}
	if n := len(reLiteralTx.FindAllString(dn, -1)); n != 0 {
		t.Errorf("the 588 down migration contains a literal transaction statement")
	}
}
