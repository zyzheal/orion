package main

import (
	"os"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// Round 54: job-source had seven registered routes and no schema.
//
// The module's DDL lives at internal/job-source/migrations/001_create_job_source_tables.sql.
// database.LoadMigrations reads only the flat top-level directory
// (cmd/server/config.go:83 passes "migrations"), and it skips directory
// entries, so that file was never executed and every route died at the driver
// with `relation "job_sources" does not exist`. The 001_ prefix could not be
// reused either: LoadMigrations parses it with fmt.Sscanf(name, "%03d_") and
// would have collided with the already applied version 1.
//
// The repository tests pin the SQL the code sends; these pin that the relation
// and the columns it names actually exist in the applied set, so the two sides
// cannot drift apart again.

func jsRepositorySQL() string {
	b, err := os.ReadFile("../../internal/job-source/repository/repository.go")
	if err != nil {
		return ""
	}
	return string(b)
}

func jsModelsSource() string {
	b, err := os.ReadFile("../../internal/job-source/models/models.go")
	if err != nil {
		return ""
	}
	return string(b)
}

func jsStrandedDDL() string {
	b, err := os.ReadFile("../../internal/job-source/migrations/001_create_job_source_tables.sql")
	if err != nil {
		return ""
	}
	return string(b)
}

var reJSRelation = regexp.MustCompile(`(?is)\b(?:FROM|INTO|UPDATE|TABLE)\s+(job_source_events?|job_sources)\b`)
var reJSIndex = regexp.MustCompile(`(?is)CREATE INDEX IF NOT EXISTS ([a-z_][a-z0-9_]*)`)

func jsRelationsNamedByRepository() []string {
	out := []string{}
	for _, m := range reJSRelation.FindAllStringSubmatch(jsRepositorySQL(), -1) {
		if !containsStr(out, m[1]) {
			out = append(out, m[1])
		}
	}
	sort.Strings(out)
	return out
}

// jsCreators returns every forward top-level migration whose CREATE TABLE names
// table.
func jsCreators(table string) []string {
	out := []string{}
	for _, f := range entriesInMigrationsDir() {
		if strings.HasSuffix(f.name, "_down.sql") {
			continue
		}
		if _, ok := parseCreateTables(f.body)[table]; ok {
			out = append(out, f.name)
		}
	}
	sort.Strings(out)
	return out
}

// jsSchema is the accumulated column set for one table across every forward
// top-level migration, so an ADD COLUMN in a later migration counts as declared.
func jsSchema(table string) map[string]bool {
	out := map[string]bool{}
	for _, f := range entriesInMigrationsDir() {
		if strings.HasSuffix(f.name, "_down.sql") {
			continue
		}
		for c := range parseCreateTables(f.body)[table] {
			out[c] = true
		}
	}
	return out
}

func TestMigration_JobSource_BothRelationsHaveExactlyOneOwner(t *testing.T) {
	for _, table := range []string{"job_sources", "job_source_events"} {
		owners := jsCreators(table)
		t.Logf("%s created by %d migration(s): %v", table, len(owners), owners)
		if len(owners) == 0 {
			t.Errorf("no migration creates %s, but the repository INSERTs into it", table)
		}
		if len(owners) > 1 {
			t.Errorf("%s is created by %d migrations %v, so a later one redefines the earlier",
				table, len(owners), owners)
		}
	}
}

// The repository addresses nothing the applied set does not own. Before 685
// this test reported both relations as ownerless, which is the exact failure
// mode the module was shipping in.
func TestMigration_JobSource_RepositoryOnlyAddressesOwnedRelations(t *testing.T) {
	named := jsRelationsNamedByRepository()
	t.Logf("repository addresses %d relation(s): %v", len(named), named)
	if len(named) == 0 {
		t.Fatal("no relation found in the repository, so the detector is reading the wrong file")
	}
	for _, rel := range named {
		if len(jsCreators(rel)) == 0 {
			t.Errorf("repository addresses %s, which no forward migration creates", rel)
		}
	}
	for _, want := range []string{"job_sources", "job_source_events"} {
		if !containsStr(named, want) {
			t.Errorf("repository no longer addresses %s", want)
		}
	}
}

// Both INSERTs are named-exec statements, so every column they list must exist
// in the DDL. sqlx fails the whole statement on one missing column.
func TestMigration_JobSource_InsertColumnsExistInTheDDL(t *testing.T) {
	checks := []struct {
		table   string
		columns map[string]bool
	}{
		{"job_sources", jsSchema("job_sources")},
		{"job_source_events", jsSchema("job_source_events")},
	}
	for _, tc := range checks {
		got := insertColumns(jsRepositorySQL(), tc.table)
		t.Logf("INSERT INTO %s lists %d column(s): %v", tc.table, len(got), got)
		if len(got) == 0 {
			t.Errorf("no INSERT INTO %s parsed from the repository, so the detector is wrong", tc.table)
			continue
		}
		for _, c := range columnsNotDeclared(tc.columns, got) {
			t.Errorf("INSERT INTO %s writes %s, which no migration declares", tc.table, c)
		}
	}
}

// jsDbTags returns the db:"..." columns declared by one struct in models.go.
// The disaster-recovery helper reads that module's file, so this one is
// re-pointed at job-source.
func jsDbTags(typ string) []string {
	for _, m := range reStructBlock.FindAllStringSubmatch(jsModelsSource(), -1) {
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

// Both models are read back with SELECT *, so every db:"..." tag must resolve
// to a declared column. An extra column in the DDL only breaks the bind if it
// is not in the struct; a missing one breaks every read of the relation.
func TestMigration_JobSource_ModelTagsResolveAgainstTheDDL(t *testing.T) {
	checks := []struct {
		typ     string
		columns map[string]bool
	}{
		{"JobSource", jsSchema("job_sources")},
		{"JobSourceEvent", jsSchema("job_source_events")},
	}
	for _, tc := range checks {
		tags := jsDbTags(tc.typ)
		t.Logf("%s declares %d db tag(s): %v", tc.typ, len(tags), tags)
		if len(tags) == 0 {
			t.Fatalf("no db tags parsed for %s, so the detector is wrong", tc.typ)
		}
		for _, c := range tags {
			if !tc.columns[c] {
				t.Errorf("%s db:%q has no column: every read of the relation fails", tc.typ, c)
			}
		}
	}
}

// 685 copied its DDL from the stranded module file. Keep the two aligned so a
// later edit to either side is caught here instead of in production.
func TestMigration_JobSource_AppliedDDLMatchesTheStrandedModuleDDL(t *testing.T) {
	stranded := jsStrandedDDL()
	if stranded == "" {
		t.Skip("module-local 001 DDL is gone; the copy source for 685 no longer exists")
	}
	for _, table := range []string{"job_sources", "job_source_events"} {
		a := parseCreateTables(stranded)[table]
		b := jsSchema(table)
		if len(a) == 0 {
			t.Fatalf("module-local DDL declares no columns for %s", table)
		}
		for c := range a {
			if !b[c] {
				t.Errorf("685 is missing %s.%s, which the module DDL declares", table, c)
			}
		}
	}
}

// The up migration must have a reversal that removes both relations. 106 of the
// 254 down files in this repo contain no DROP TABLE at all, so the reversal is
// asserted rather than assumed.
func TestMigration_JobSource_DownDropsBothRelations(t *testing.T) {
	up := "685_create_job_source_missing_tables.sql"
	down := up[:len(up)-len(".sql")] + "_down.sql"
	upBody := migrationBody(t, up)
	downBody := migrationBody(t, down)

	if !strings.Contains(downBody, "DROP TABLE IF EXISTS job_source_events") {
		t.Errorf("%s does not drop job_source_events", down)
	}
	if !strings.Contains(downBody, "DROP TABLE IF EXISTS job_sources") {
		t.Errorf("%s does not drop job_sources", down)
	}
	// The event table holds the foreign key, so it must go first; otherwise the
	// drop fails on the constraint instead of undoing the up migration.
	if strings.Index(downBody, "DROP TABLE IF EXISTS job_source_events") >
		strings.Index(downBody, "DROP TABLE IF EXISTS job_sources") {
		t.Errorf("%s drops job_sources before job_source_events, which fails on the foreign key", down)
	}
	// Indexes are created by the up migration and must not survive the drop.
	// PostgreSQL removes them with their table, so name them only to prove the
	// up migration really creates what it claims.
	created := []string{}
	for _, m := range reJSIndex.FindAllStringSubmatch(upBody, -1) {
		created = append(created, m[1])
	}
	sort.Strings(created)
	t.Logf("%s creates %d index(es): %v", up, len(created), created)
	if len(created) != 8 {
		t.Errorf("%s creates %d indexes, want 8 (4 per relation)", up, len(created))
	}
}

// Two files under one version number would apply at the same step, and the
// later one would silently overwrite the earlier. This pair was first written
// as 678 and another agent claimed that slot mid-flight, so it was renumbered
// to 685. The assertion reads the number from jsMigrationVersion so a repeat
// collision forces an edit here instead of leaving a test that quietly passes
// against the wrong file pair.
func TestMigration_JobSource_VersionIsUnique(t *testing.T) {
	const jsMigrationVersion = "685"
	owners := []string{}
	for _, f := range entriesInMigrationsDir() {
		if strings.HasPrefix(f.name, jsMigrationVersion+"_") {
			owners = append(owners, f.name)
		}
	}
	sort.Strings(owners)
	t.Logf("version 685 is used by %d file(s): %v", len(owners), owners)
	if len(owners) < 1 {
		t.Error("no migration uses version 685; the job-source tables are unowned")
	}
	forwards := []string{}
	downs := []string{}
	for _, n := range owners {
		if strings.HasSuffix(n, "_down.sql") {
			downs = append(downs, n)
		} else {
			forwards = append(forwards, n)
		}
	}
	if len(forwards) != 1 {
		t.Errorf("version 685 has %d forward migration(s): %v", len(forwards), forwards)
	}
	if len(downs) != 1 {
		t.Errorf("version 685 has %d down migration(s): %v", len(downs), downs)
	}
}

// The module-local 001_ file cannot be renamed into the top-level set: LoadMigrations
// parses it as version 1, which is already taken. Assert the collision so the
// renumbering decision stays visible.
func TestMigration_JobSource_ModulePrefix001WouldCollide(t *testing.T) {
	colliding := []string{}
	for _, f := range entriesInMigrationsDir() {
		if strings.HasPrefix(f.name, "001_") && !strings.HasSuffix(f.name, "_down.sql") {
			colliding = append(colliding, f.name)
		}
	}
	sort.Strings(colliding)
	if len(colliding) == 0 {
		t.Fatal("version 1 is not taken, so the renumbering rationale is stale")
	}
	if containsStr(colliding, "001_create_job_source_tables.sql") {
		t.Error("the module-local file was promoted under its 001_ name, colliding with the applied version 1")
	}
}

// received_at is NOT NULL and ORDER BY received_at DESC sorts on it, so the
// repository must fill an unset value rather than letting the zero time (year 1)
// be written.
func TestMigration_JobSource_ReceivedAtIsNotNullAndTheRepositoryFillsIt(t *testing.T) {
	upBody := migrationBody(t, "685_create_job_source_missing_tables.sql")
	if !reMust(`(?is)received_at\s+TIMESTAMPTZ\s+NOT NULL`).MatchString(upBody) {
		t.Error("685 no longer declares received_at NOT NULL; the repository default is now redundant")
	}
	if !reMust(`(?is)received_at\s+TIMESTAMPTZ`).MatchString(upBody) {
		t.Error("685 does not declare received_at at all")
	}
	src := jsRepositorySQL()
	if !strings.Contains(src, "ReceivedAt.IsZero()") {
		t.Error("repository no longer fills an unset ReceivedAt, so a zero timestamp would be written into a NOT NULL column")
	}
	// The repository must not invent the row identity: source_id is NOT NULL and
	// there is no honest default for it.
	if reMust(`(?is)SourceID\s*=\s*`).MatchString(src) {
		t.Error("repository assigns a SourceID; an invented value would be worse than a loud failure")
	}
}
