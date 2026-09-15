package main

import (
	"os"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// Round 52: all nine statements in internal/artifact-lifecycle/repository
// addressed artifact_lifecycle (singular) while migration 094 creates
// artifact_lifecycles, which 239, 570 and 572 also own. Nothing ever created
// the singular name, so all seven registered /artifact-lifecycle routes died at
// the driver with `pq: relation "artifact_lifecycle" does not exist`. The
// repository tests pin the SQL the code sends; these pin that the relation and
// columns it names really exist in the migrations, so the two sides cannot
// drift apart again.

func artifactLifecycleRepositorySQL() string {
	b, err := os.ReadFile("../../internal/artifact-lifecycle/repository/repository.go")
	if err != nil {
		return ""
	}
	return string(b)
}

var reArtifactRelationPos = regexp.MustCompile(`(?is)\b(?:FROM|INTO|UPDATE|TABLE)\s+(artifact_lifecycles?)\b`)

func artifactRelationsNamedByRepository() []string {
	out := []string{}
	for _, m := range reArtifactRelationPos.FindAllStringSubmatch(artifactLifecycleRepositorySQL(), -1) {
		if !containsStr(out, m[1]) {
			out = append(out, m[1])
		}
	}
	sort.Strings(out)
	return out
}

// artifactSchema returns the columns 094 declares on artifact_lifecycles plus
// every column a later migration adds to it.
func artifactSchema(t *testing.T) (cols map[string]bool, creator string) {
	t.Helper()
	cols = map[string]bool{}
	for _, f := range entriesInMigrationsDir() {
		for table, tc := range parseCreateTables(f.body) {
			if table != "artifact_lifecycles" {
				continue
			}
			creator = f.name
			for c := range tc {
				cols[c] = true
			}
		}
	}
	reAddCol := regexp.MustCompile(`(?is)ALTER TABLE artifact_lifecycles ADD COLUMN ([a-z_][a-z0-9_]*)`)
	for _, f := range entriesInMigrationsDir() {
		for _, m := range reAddCol.FindAllStringSubmatch(f.body, -1) {
			cols[strings.ToLower(m[1])] = true
		}
	}
	return cols, creator
}

// TestMigration_ArtifactLifecycle_RelationIsPluralAndUnique pins that exactly
// one migration creates the relation the repository addresses, and that it is
// the plural one. If the repository ever names the singular spelling again the
// first check fails, which is the defect itself.
func TestMigration_ArtifactLifecycle_RelationIsPluralAndUnique(t *testing.T) {
	_, creator := artifactSchema(t)
	if creator != "094_create_artifact-lifecycle_tables.sql" {
		t.Fatalf("artifact_lifecycles must be created by exactly 094, got %q", creator)
	}

	relations := artifactRelationsNamedByRepository()
	if len(relations) != 1 || relations[0] != "artifact_lifecycles" {
		t.Fatalf("repository must address only artifact_lifecycles, got %v", relations)
	}

	// The singular spelling must not be created anywhere. Mask the plural first:
	// artifact_lifecycle is a prefix of artifact_lifecycles and Go's regexp has
	// no lookahead.
	reSingular := regexp.MustCompile(`artifact_lifecycle\b`)
	rePlural := regexp.MustCompile(`artifact_lifecycles\b`)
	offenders := []string{}
	for _, f := range entriesInMigrationsDir() {
		if len(reSingular.FindAllString(rePlural.ReplaceAllString(f.body, "PLURAL"), -1)) > 0 {
			offenders = append(offenders, f.name)
		}
	}
	if len(offenders) > 0 {
		t.Errorf("migrations name the singular relation: %v", offenders)
	}
	if !reSingular.MatchString("CREATE TABLE artifact_lifecycle (id UUID);") {
		t.Fatal("detector failed to match the singular spelling")
	}
	if reSingular.MatchString(rePlural.ReplaceAllString("CREATE TABLE artifact_lifecycles (id UUID);", "PLURAL")) {
		t.Fatal("detector matched the plural spelling")
	}
}

// TestMigration_ArtifactLifecycle_InsertColumnsExistInTheDDL parses the INSERT
// column list and the model's db tags and checks every column against the DDL.
// artifact_id in particular is worth pinning: GetStageHistory takes it as its
// first argument while its parameter is named id, which is easy to drift.
func TestMigration_ArtifactLifecycle_InsertColumnsExistInTheDDL(t *testing.T) {
	cols, _ := artifactSchema(t)
	if len(cols) == 0 {
		t.Fatal("no columns parsed from the migrations")
	}

	reInsert := regexp.MustCompile(`(?is)INSERT INTO artifact_lifecycles \(([^)]*)\)`)
	m := reInsert.FindStringSubmatch(artifactLifecycleRepositorySQL())
	if m == nil {
		t.Fatal("detector found no INSERT in the repository")
	}
	inserted := 0
	for _, col := range strings.Split(m[1], ",") {
		col = strings.TrimSpace(col)
		if col == "" {
			continue
		}
		inserted++
		if !cols[strings.ToLower(col)] {
			t.Errorf("artifact_lifecycles has no column %s; no migration adds it", col)
		}
	}
	if inserted != 7 {
		t.Fatalf("expected 7 insert columns, counted %d", inserted)
	}
	t.Logf("checked %d insert columns against the migration DDL", inserted)

	// The model's db tags are the columns a SELECT * scans into.
	b, err := os.ReadFile("../../internal/artifact-lifecycle/models/models.go")
	if err != nil {
		t.Fatalf("read models.go: %v", err)
	}
	reTag := regexp.MustCompile(`db:"([a-z_]+)"`)
	tagged := 0
	for _, tag := range reTag.FindAllStringSubmatch(string(b), -1) {
		tagged++
		if !cols[tag[1]] {
			t.Errorf("the model scans column %s which no migration declares", tag[1])
		}
	}
	if tagged != 7 {
		t.Fatalf("expected 7 db tags, counted %d", tagged)
	}
}

// TestMigration_ArtifactLifecycle_StageStatusIsNotNull pins the DDL fact that
// made the pre-fix Update a hard failure: stage_status is NOT NULL and the
// service never put it in the map, so every advance bound nil into a NOT NULL
// column. If someone makes stage_status nullable this test fails, and they
// should have to look at the Update logic again.
func TestMigration_ArtifactLifecycle_StageStatusIsNotNull(t *testing.T) {
	up := migrationBody(t, "094_create_artifact-lifecycle_tables.sql")
	reStageStatus := regexp.MustCompile(`(?ims)^\s*stage_status\s+([a-z()0-9]+)\s+(NOT\s+NULL)?`)
	m := reStageStatus.FindStringSubmatch(up)
	if m == nil {
		t.Fatal("detector found no stage_status declaration in 094")
	}
	if strings.TrimSpace(m[2]) == "" {
		t.Fatalf("stage_status is %q with no NOT NULL; the repository test that "+
			"pins the not-null failure no longer applies", m[1])
	}
	t.Logf("stage_status is %s %s", m[1], strings.TrimSpace(m[2]))
}

// TestMigration_ArtifactLifecycle_LaterMigrationsOwnTheRelation lists the
// migrations that alter the relation. This is the evidence for fixing the code
// instead of the DDL: renaming the table in a new migration would leave these
// three migrations altering a different, empty relation.
func TestMigration_ArtifactLifecycle_LaterMigrationsOwnTheRelation(t *testing.T) {
	owners := []string{}
	for _, f := range entriesInMigrationsDir() {
		if strings.HasSuffix(f.name, "_down.sql") {
			continue
		}
		if f.name == "094_create_artifact-lifecycle_tables.sql" {
			continue
		}
		if strings.Contains(f.body, "artifact_lifecycles") {
			owners = append(owners, f.name)
		}
	}
	sort.Strings(owners)
	if len(owners) == 0 {
		t.Fatal("no later migration owns artifact_lifecycles; the table name " +
			"cannot be treated as canonical")
	}
	for _, o := range owners {
		t.Logf("later owner: %s", o)
	}
	if !containsStr(owners, "570_add_foreign_keys.sql") {
		t.Fatalf("570 owns fk_artifact_lifecycles_tenant and must appear: %v", owners)
	}
	if !containsStr(owners, "572_add_audit_columns.sql") {
		t.Fatalf("572 adds created_by to artifact_lifecycles and must appear: %v", owners)
	}
}

// TestMigration_DownMigrationsThatCreateTablesDoNotAlwaysDropThem measures a
// generator gap rather than asserting one. It never fails, so it is a
// measurement with no regression power: it exists so the count is visible in
// the test log instead of a hand-quoted number in the docs.
func TestMigration_DownMigrationsThatCreateTablesDoNotAlwaysDropThem(t *testing.T) {
	type pair struct{ up, down string }
	var pairs []pair
	byName := map[string]string{}
	for _, f := range entriesInMigrationsDir() {
		byName[f.name] = f.body
	}
	for name, body := range byName {
		if strings.HasSuffix(name, "_down.sql") {
			continue
		}
		if len(parseCreateTables(body)) == 0 {
			continue
		}
		downName := strings.TrimSuffix(name, ".sql") + "_down.sql"
		if _, ok := byName[downName]; !ok {
			continue
		}
		pairs = append(pairs, pair{name, byName[downName]})
	}
	sort.Slice(pairs, func(i, j int) bool { return pairs[i].up < pairs[j].up })

	reDropTable := regexp.MustCompile(`(?is)DROP TABLE IF EXISTS\s+"?([a-z_][a-z0-9_]*)"?`)
	empty := 0
	for _, p := range pairs {
		created := []string{}
		for table := range parseCreateTables(byName[p.up]) {
			created = append(created, table)
		}
		sort.Strings(created)
		dropped := []string{}
		for _, m := range reDropTable.FindAllStringSubmatch(p.down, -1) {
			dropped = append(dropped, m[1])
		}
		missing := 0
		for _, table := range created {
			if !containsStr(dropped, table) {
				missing++
			}
		}
		if missing == len(created) {
			empty++
		}
	}
	t.Logf("%d of %d forward migrations that create at least one table have a "+
		"down migration that drops none of them (the generator emits the indexes "+
		"but omits the DROP TABLE statements)", empty, len(pairs))
	if empty == 0 || empty >= len(pairs) {
		t.Fatalf("count is degenerate: %d of %d", empty, len(pairs))
	}
}
