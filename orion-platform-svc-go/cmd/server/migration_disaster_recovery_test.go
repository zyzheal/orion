package main

import (
	"os"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// Round 53: three gaps on the six registered /disaster-recovery routes were
// invisible to every repository test because they live in the migrations.
//
//   1. recovery_run had no DDL anywhere, so POST
//      /disaster-recovery/plans/:id/run died with `pq: relation
//      "recovery_run" does not exist` before the plan's last_run update ran.
//   2. recovery_run had no ended_at and no error_message column, so a
//      finished run could not be recorded as finished: the service re-ran
//      CreateRun, which inserted a second row under a fresh id and left the
//      original at status='running' forever.
//   3. disaster_plans.steps is VARCHAR(255) and holds a JSON array of shell
//      commands, and disaster_plans.last_run is NOT NULL while
//      models.DisasterPlan.LastRun is nil until a plan is first run.
//
// The repository tests pin the SQL the code sends. These pin that the
// relation and columns it names really exist in the migrations, so the two
// sides cannot drift apart again.

func drRepositorySQL() string {
	b, err := os.ReadFile("../../internal/disaster-recovery/repository/repository.go")
	if err != nil {
		return ""
	}
	return string(b)
}

func drModelsSource() string {
	b, err := os.ReadFile("../../internal/disaster-recovery/models/models.go")
	if err != nil {
		return ""
	}
	return string(b)
}

var reDROwner = regexp.MustCompile(`(?is)\b(?:FROM|INTO|UPDATE|TABLE)\s+(disaster_plans?|recovery_run)\b`)

var reRunAddColumn = regexp.MustCompile(`(?is)ALTER TABLE recovery_run ADD COLUMN(?: IF NOT EXISTS)? ([a-z_][a-z0-9_]*)`)

var reRunDirectTenantFilter = regexp.MustCompile(`(?is)r\.tenant_id`)

// reCreateIndex pulls the index names out of a CREATE INDEX IF NOT EXISTS line.
var reCreateIndex = regexp.MustCompile(`(?is)CREATE INDEX IF NOT EXISTS ([a-z_][a-z0-9_]*)`)
var reRunAlterTenant = regexp.MustCompile(`(?is)ALTER TABLE recovery_run ADD COLUMN(?: IF NOT EXISTS)? tenant_id`)

// drRunColumns returns the columns recovery_run has after every migration runs:
// the CREATE TABLE declarations plus every later ADD COLUMN. The owner adds
// ended_at and error_message with IF NOT EXISTS so the pair stays
// order-independent against a concurrent creator of the same table.
func drRunColumns() map[string]bool {
	out := map[string]bool{}
	for _, f := range entriesInMigrationsDir() {
		for c := range parseCreateTables(f.body)["recovery_run"] {
			out[c] = true
		}
		for _, m := range reRunAddColumn.FindAllStringSubmatch(f.body, -1) {
			out[strings.ToLower(m[1])] = true
		}
	}
	return out
}

// drPlanColumns returns the columns disaster_plans has after every migration runs.
func drPlanColumns() map[string]bool {
	out := map[string]bool{}
	for _, f := range entriesInMigrationsDir() {
		for c := range parseCreateTables(f.body)["disaster_plans"] {
			out[c] = true
		}
	}
	return out
}

// drRelationsNamedByRepository lists the relations the module's SQL addresses.
func drRelationsNamedByRepository() []string {
	out := []string{}
	for _, m := range reDROwner.FindAllStringSubmatch(drRepositorySQL(), -1) {
		if !containsStr(out, m[1]) {
			out = append(out, m[1])
		}
	}
	sort.Strings(out)
	return out
}

// drCreators returns every migration whose CREATE TABLE names table.
func drCreators(table string) []string {
	out := []string{}
	for _, f := range entriesInMigrationsDir() {
		if _, ok := parseCreateTables(f.body)[table]; ok {
			out = append(out, f.name)
		}
	}
	sort.Strings(out)
	return out
}

// Two creators of one relation mean a later migration silently redefines what
// an earlier one promised. Zero means the repository dies at the driver.
func TestMigration_DisasterRecovery_BothRelationsHaveExactlyOneOwner(t *testing.T) {
	for _, table := range []string{"disaster_plans", "recovery_run"} {
		owners := drCreators(table)
		t.Logf("%s created by %d migration(s): %v", table, len(owners), owners)
		if len(owners) == 0 {
			t.Errorf("no migration creates %s, but the repository INSERTs into it", table)
		}
		if len(owners) > 1 {
			t.Errorf("%s is created by %d migrations %v, so a later one redefines the earlier", table, len(owners), owners)
		}
	}
	// 124 is the undisputed creator of the plans table and it is the plural
	// spelling, so the repository was renamed to match it rather than the
	// reverse: 239 casts its tenant_id to UUID, 570 adds
	// fk_disaster_plans_tenant and 572 adds created_by and updated_by.
	if owners := drCreators("disaster_plans"); len(owners) == 1 && owners[0] != "124_create_disaster-recovery_tables.sql" {
		t.Errorf("expected 124 to own disaster_plans, got %s", owners[0])
	}
	// disaster_plan (singular) must have no owner at all: it is the pre-fix
	// spelling and no migration ever created it.
	if owners := drCreators("disaster_plan"); len(owners) != 0 {
		t.Errorf("disaster_plan (singular) is created by %v, so the repository would have to address it", owners)
	}
}

func TestMigration_DisasterRecovery_RepositoryOnlyAddressesOwnedRelations(t *testing.T) {
	named := drRelationsNamedByRepository()
	t.Logf("repository addresses %d relation(s): %v", len(named), named)
	if len(named) == 0 {
		t.Fatal("no relation found in the repository, so the detector is reading the wrong file")
	}
	owned := map[string]bool{
		"disaster_plans": len(drCreators("disaster_plans")) > 0,
		"recovery_run":   len(drCreators("recovery_run")) > 0,
	}
	for _, rel := range named {
		if !owned[rel] {
			t.Errorf("repository addresses %s, which no migration creates", rel)
		}
	}
	if !containsStr(named, "disaster_plans") {
		t.Error("repository no longer addresses disaster_plans, the relation 124 owns")
	}
}

// Every column the INSERT lists and every db:"..." tag the model declares must
// exist in the schema 124 plus the recovery_run owner build.
func TestMigration_DisasterRecovery_InsertColumnsExistInTheDDL(t *testing.T) {
	plans := drPlanColumns()
	runs := drRunColumns()
	t.Logf("disaster_plans columns: %d; recovery_run columns: %d", len(plans), len(runs))

	cases := []struct {
		table   string
		columns map[string]bool
	}{
		{"disaster_plans", plans},
		{"recovery_run", runs},
	}
	for _, tc := range cases {
		got := insertColumns(drRepositorySQL(), tc.table)
		t.Logf("INSERT INTO %s lists %d column(s): %v", tc.table, len(got), got)
		if len(got) == 0 {
			t.Errorf("no INSERT INTO %s parsed from the repository", tc.table)
			continue
		}
		for _, c := range columnsNotDeclared(tc.columns, got) {
			t.Errorf("INSERT INTO %s writes %s, which no migration declares", tc.table, c)
		}
	}
}

// UpdateRun writes status, ended_at and error_message by position, so those
// three columns must exist too. The INSERT list does not cover them.
func TestMigration_DisasterRecovery_UpdateColumnsExistInTheDDL(t *testing.T) {
	runs := drRunColumns()
	for _, c := range columnsNotDeclared(runs, []string{"status", "ended_at", "error_message"}) {
		t.Errorf("UpdateRun writes recovery_run.%s, which no migration declares", c)
	}
}

// columnsNotDeclared is the single predicate that proves a column list against
// a schema. TestMigration_DisasterRecovery_ColumnCheckerFindsUndeclaredColumns
// pins that it reports a genuinely missing column, so an assertion built on it
// cannot pass vacuously.
func columnsNotDeclared(cols map[string]bool, got []string) []string {
	out := []string{}
	for _, c := range got {
		if !cols[c] {
			out = append(out, c)
		}
	}
	return out
}

func TestMigration_DisasterRecovery_ColumnCheckerFindsUndeclaredColumns(t *testing.T) {
	missing := columnsNotDeclared(map[string]bool{"a": true}, []string{"a", "b", "c"})
	if len(missing) != 2 || missing[0] != "b" || missing[1] != "c" {
		t.Errorf("checker must report both undeclared columns in order, got %v", missing)
	}
	if declared := columnsNotDeclared(map[string]bool{"a": true, "b": true}, []string{"a", "b"}); len(declared) != 0 {
		t.Errorf("checker must not report declared columns, got %v", declared)
	}
}

var reDbTag = regexp.MustCompile(`db:"([a-z_][a-z0-9_]*)"`)
var reStructBlock = regexp.MustCompile(`(?s)type\s+(\w+)\s+struct\s*\{([\s\S]*?)\n\}`)

// dbTags returns the db:"..." columns declared by one struct in models.go.
func dbTags(typ string) []string {
	for _, m := range reStructBlock.FindAllStringSubmatch(drModelsSource(), -1) {
		if m[1] != typ {
			continue
		}
		out := []string{}
		for _, tag := range reDbTag.FindAllStringSubmatch(m[2], -1) {
			out = append(out, tag[1])
		}
		return out
	}
	return nil
}

// Both models' db tags must resolve to a column the migrations declare. sqlx
// fails the whole statement on one missing column, so a tag added in code and
// forgotten in the migrations would break every read of the relation.
func TestMigration_DisasterRecovery_ModelTagsResolveAgainstTheDDL(t *testing.T) {
	checks := []struct {
		typ     string
		columns map[string]bool
	}{
		{"DisasterPlan", drPlanColumns()},
		{"RecoveryRun", drRunColumns()},
	}
	for _, tc := range checks {
		tags := dbTags(tc.typ)
		t.Logf("%s declares %d db tag(s): %v", tc.typ, len(tags), tags)
		if len(tags) == 0 {
			t.Fatalf("no db tags parsed for %s, so the detector is wrong", tc.typ)
		}
		for _, c := range tags {
			if !tc.columns[c] {
				t.Errorf("%s db:%q has no column: sqlx selects it and every read fails", tc.typ, c)
			}
		}
	}
}

// recovery_run has no tenant_id column: tenancy reaches a run only through the
// JOIN onto disaster_plans. A future ALTER that adds a tenant column would
// make the JOIN filter redundant, and a service change that relied on it
// directly would bypass the ownership check RunPlan makes before inserting.
func TestMigration_DisasterRecovery_RecoveryRunStaysUnscopedByTenant(t *testing.T) {
	for _, f := range entriesInMigrationsDir() {
		if parseCreateTables(f.body)["recovery_run"]["tenant_id"] {
			t.Errorf("%s declares tenant_id on recovery_run; the repository scopes runs through the disaster_plans JOIN", f.name)
		}
		if reRunAlterTenant.MatchString(f.body) {
			t.Errorf("%s adds tenant_id to recovery_run", f.name)
		}
	}
	if !strings.Contains(drRepositorySQL(), "p.tenant_id") {
		t.Error("repository no longer filters runs through the joined plan's tenant_id")
	}
	if reRunDirectTenantFilter.MatchString(drRepositorySQL()) {
		t.Error("repository filters recovery_run.tenant_id directly, a column that does not exist")
	}
}

// 124 declares steps VARCHAR(255) NOT NULL and last_run ... NOT NULL. Both are
// wrong for what the repository writes: a JSON array of shell commands overflows
// 255, and a plan that has never run has no last run. The owner must widen the
// one and relax the other, and exactly one migration must do each so the
// intended final shape is unambiguous.
func TestMigration_DisasterRecovery_StepsIsWidenedAndLastRunIsNullable(t *testing.T) {
	base := migrationBody(t, "124_create_disaster-recovery_tables.sql")
	if !reMust(`steps\s+VARCHAR\s*\(\s*255\s*\)[^,]*NOT NULL`).MatchString(base) {
		t.Error("124 no longer declares steps VARCHAR(255) NOT NULL, so the widening rationale is stale")
	}
	if !reMust(`last_run\s+TIMESTAMP WITH TIME ZONE NOT NULL`).MatchString(base) {
		t.Error("124 no longer declares last_run NOT NULL, so the relaxation rationale is stale")
	}

	type fix struct {
		what string
		re   *regexp.Regexp
	}
	fixes := []fix{
		{"ALTER COLUMN steps TYPE TEXT", reMust(`(?is)ALTER TABLE disaster_plans ALTER COLUMN steps TYPE TEXT`)},
		{"ALTER COLUMN last_run DROP NOT NULL", reMust(`(?is)ALTER TABLE disaster_plans ALTER COLUMN last_run DROP NOT NULL`)},
	}
	for _, f := range fixes {
		hits := []string{}
		for _, m := range entriesInMigrationsDir() {
			if f.re.MatchString(m.body) {
				hits = append(hits, m.name)
			}
		}
		t.Logf("%s applied by %d migration(s): %v", f.what, len(hits), hits)
		if len(hits) != 1 {
			t.Errorf("%s must be applied by exactly one migration, found %v", f.what, hits)
		}
	}
}

// 124 is the creator, but three later migrations own the same relation. That is
// the evidence for renaming the code instead of the DDL: reverting the
// repository to disaster_plan would have made 239, 570 and 572 unreachable.
func TestMigration_DisasterRecovery_LaterMigrationsOwnThePlansRelation(t *testing.T) {
	for _, name := range []string{
		"239_unify_tenant_id_to_uuid.sql",
		"570_add_foreign_keys.sql",
		"572_add_audit_columns.sql",
	} {
		body := migrationBody(t, name)
		if !strings.Contains(body, "disaster_plans") {
			t.Errorf("%s no longer references disaster_plans; the code-follows-DDL rationale changes", name)
		}
	}
}

// The down migration must actually reverse the up migration. 106 of 254 down
// files in this repo contain no DROP TABLE at all, so the reversal is asserted
// here rather than assumed.
func TestMigration_DisasterRecovery_DownReversesTheUp(t *testing.T) {
	owner := drCreators("recovery_run")
	if len(owner) != 1 {
		t.Fatalf("expected one recovery_run owner, got %v", owner)
	}
	upName := owner[0]
	downName := strings.TrimSuffix(upName, ".sql") + "_down.sql"
	up := migrationBody(t, upName)
	down := migrationBody(t, downName)

	// Every index the up migration creates must be dropped by name. The names
	// come out of the up file rather than a hardcoded list, so adding an index
	// to the up migration fails this test instead of silently outliving it.
	created := []string{}
	for _, m := range reCreateIndex.FindAllStringSubmatch(up, -1) {
		created = append(created, m[1])
	}
	sort.Strings(created)
	t.Logf("%s creates %d index(es) %v", upName, len(created), created)
	if len(created) == 0 {
		t.Errorf("%s creates no indexes, so the index detector is reading the wrong file", upName)
	}
	for _, idx := range created {
		want := "DROP INDEX IF EXISTS " + idx
		if !strings.Contains(down, want) {
			t.Errorf("%s does not contain %q", downName, want)
		}
	}
	if !strings.Contains(down, "DROP TABLE IF EXISTS recovery_run") {
		t.Errorf("%s does not drop recovery_run", downName)
	}
	for _, re := range []*regexp.Regexp{
		reMust(`(?is)ALTER COLUMN last_run SET NOT NULL`),
		reMust(`(?is)ALTER COLUMN steps TYPE VARCHAR\s*\(\s*255\s*\)`),
	} {
		if !re.MatchString(down) {
			t.Errorf("%s does not restore the 124 shape for last_run/steps", downName)
		}
	}
}

func reMust(pattern string) *regexp.Regexp {
	return regexp.MustCompile(pattern)
}

func insertColumns(src, table string) []string {
	re := regexp.MustCompile(`(?is)INSERT\s+INTO\s+` + regexp.QuoteMeta(table) + `\s*\(([^)]*)\)`)
	m := re.FindStringSubmatch(src)
	if m == nil {
		return nil
	}
	var out []string
	for _, c := range strings.Split(m[1], ",") {
		if c = strings.TrimSpace(strings.ToLower(c)); c != "" {
			out = append(out, c)
		}
	}
	return out
}
