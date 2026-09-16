package main

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// Round 55: the ticket domain's SLA, dispatch, suspend and comment repositories
// had registered routes and no schema.
//
// internal/ticket/repository and internal/ticketing/repository send byte-identical
// statements for sla_targets, sla_records, ticket_comments, dispatch_engineers,
// dispatch_records, dispatch_rules, dispatch_queue and suspend_records, and
// 076_create_ticketing_tables.sql created none of the eight. 076 owns only the
// ticketing_* family plus tickets, ticket_relations, ticket_transfers and
// ticket_workflow_history, so the plain-named tables were left behind rather
// than forgotten. Every one of the twenty-four routes that read or wrote them
// died at the driver with `relation "ticket_comments" does not exist` and
// friends.
//
// Seven of the eight are read back with SELECT *, which is what makes them
// load-bearing: sqlx runs in safe mode, so a result column without a db:"..."
// destination field fails the whole call. That assertion is the one that caught
// the sla_targets.tenant_id hole in this round.

const tkMigrationFile = "686_create_ticket_domain_missing_tables.sql"

// tkOwnedRelations is the complete set 686 claims. It is a constant rather than
// derived from the migration, so adding a table to the file is a test failure
// and a deliberate scope decision instead of a silent expansion.
var tkOwnedRelations = []string{
	"sla_targets",
	"sla_records",
	"ticket_comments",
	"dispatch_engineers",
	"dispatch_records",
	"dispatch_rules",
	"dispatch_queue",
	"suspend_records",
}

// tkSelectStar pairs each SELECT * target with the struct the repository scans
// it into. dispatch_engineers is deliberately absent: that repository reads it
// with an explicit .Scan, so an extra column there would be harmless rather
// than fatal.
var tkSelectStar = []struct {
	table string
	typ   string
}{
	{"sla_targets", "SLATarget"},
	{"sla_records", "SLARecord"},
	{"ticket_comments", "TicketComment"},
	{"dispatch_records", "DispatchRecord"},
	{"dispatch_rules", "DispatchRule"},
	{"dispatch_queue", "DispatchQueueEntry"},
	{"suspend_records", "SuspendRecord"},
}

// tkRelationsNotClaimed records the R38 boundary: these relations are addressed
// by repository methods with no mounted route, so 686 must not create them.
var tkRelationsNotClaimed = []string{
	"assignment_rules",
	"automation_rules",
	"automation_rule_executions",
	"sla_policies",
}

var reTkDefault = regexp.MustCompile(`(?i)\bDEFAULT\b`)
var reTkRelation = regexp.MustCompile(`(?is)\b(?:FROM|INTO|UPDATE|TABLE)\s+([a-z_][a-z0-9_]*)`)

// tkRepositorySource concatenates the ticket repository sources, which is where
// every statement against the eight tables lives.
func tkRepositorySource() string {
	return tkDirSource("../../internal/ticket/repository")
}

func tkModelsSource() string {
	return tkDirSource("../../internal/ticket/models")
}

func tkDirSource(dir string) string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return ""
	}
	out := ""
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".go") || strings.HasSuffix(e.Name(), "_test.go") {
			continue
		}
		b, rerr := os.ReadFile(filepath.Join(dir, e.Name()))
		if rerr != nil {
			continue
		}
		out += string(b) + "\n"
	}
	return out
}

func tkTables686(t *testing.T) map[string]map[string]bool {
	t.Helper()
	return parseCreateTables(migrationBody(t, tkMigrationFile))
}

// tkSortedTableNames is sortedKeys for the table -> columns map, so a failure
// message lists the same tables in the same order on every run.
func tkSortedTableNames(m map[string]map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// tkCreateTableBody returns the raw column list of one CREATE TABLE, which the
// NOT NULL / DEFAULT assertions need and parseCreateTables discards.
func tkCreateTableBody(t *testing.T, table string) string {
	t.Helper()
	re := regexp.MustCompile(`(?is)CREATE TABLE\s+IF NOT EXISTS\s+` + regexp.QuoteMeta(table) + `\s*\(([\s\S]*?)\);`)
	m := re.FindStringSubmatch(migrationBody(t, tkMigrationFile))
	if m == nil {
		t.Fatalf("%s does not CREATE TABLE %s", tkMigrationFile, table)
	}
	return m[1]
}

func tkRelationsNamedByRepository() []string {
	out := []string{}
	for _, m := range reTkRelation.FindAllStringSubmatch(tkRepositorySource(), -1) {
		if !containsStr(out, m[1]) {
			out = append(out, m[1])
		}
	}
	sort.Strings(out)
	return out
}

// tkDbTags returns the db:"..." columns declared by one struct in the ticket
// models. The shared dbTags helper reads the disaster-recovery module, so this
// one is re-pointed.
func tkDbTags(typ string) []string {
	for _, m := range reStructBlock.FindAllStringSubmatch(tkModelsSource(), -1) {
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

// tkInsertStatements returns the column list of every INSERT INTO table, not
// just the first one as the shared insertColumns helper does.
func tkInsertStatements(src, table string) [][]string {
	re := regexp.MustCompile(`(?is)INSERT\s+INTO\s+` + regexp.QuoteMeta(table) + `\s*\(([^)]*)\)`)
	var out [][]string
	for _, m := range re.FindAllStringSubmatch(src, -1) {
		var cols []string
		for _, c := range strings.Split(m[1], ",") {
			if c = strings.TrimSpace(strings.ToLower(c)); c != "" {
				cols = append(cols, c)
			}
		}
		out = append(out, cols)
	}
	return out
}

// tkColumnsWithoutDestination is the one-directional half of the bijection: a
// DDL column with no db:"..." field. The reverse direction (a field with no
// column) is harmless under sqlx, so it is not reported.
func tkColumnsWithoutDestination(cols map[string]bool, tags []string) []string {
	seen := map[string]bool{}
	for _, tag := range tags {
		seen[tag] = true
	}
	out := []string{}
	for c := range cols {
		if !seen[c] {
			out = append(out, c)
		}
	}
	sort.Strings(out)
	return out
}

// tkColumnDefs reports which columns are NOT NULL and which carry a DEFAULT.
// Column declarations in 686 are one per line, which this line scan relies on.
func tkColumnDefs(body string) (notNull, hasDefault map[string]bool) {
	notNull = map[string]bool{}
	hasDefault = map[string]bool{}
	for _, line := range strings.Split(body, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "--") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) == 0 {
			continue
		}
		switch strings.ToUpper(fields[0]) {
		case "PRIMARY", "UNIQUE", "CONSTRAINT", "FOREIGN", "CHECK", "INDEX":
			continue
		}
		col := strings.ToLower(fields[0])
		if strings.Contains(strings.ToUpper(line), "NOT NULL") {
			notNull[col] = true
		}
		if reTkDefault.MatchString(line) {
			hasDefault[col] = true
		}
	}
	return notNull, hasDefault
}

// TestMigration_TicketDomain_EveryOwnedRelationHasExactlyOneCreator
//
// Zero creators is the defect this round closed; two means a later migration
// silently redefines what an earlier one promised.
func TestMigration_TicketDomain_EveryOwnedRelationHasExactlyOneCreator(t *testing.T) {
	creators := map[string][]string{}
	for _, f := range entriesInMigrationsDir() {
		if strings.HasSuffix(f.name, "_down.sql") {
			continue
		}
		for table := range parseCreateTables(f.body) {
			creators[table] = append(creators[table], f.name)
		}
	}
	for _, table := range tkOwnedRelations {
		owners := creators[table]
		t.Logf("%s created by %d migration(s): %v", table, len(owners), owners)
		if len(owners) == 0 {
			t.Errorf("no migration creates %s, but the repository INSERTs into it", table)
		}
		if len(owners) > 1 {
			t.Errorf("%s is created by %d migrations %v; a later one redefines the earlier",
				table, len(owners), owners)
		}
		if len(owners) == 1 && owners[0] != tkMigrationFile {
			t.Errorf("%s is owned by %s, want %s", table, owners[0], tkMigrationFile)
		}
	}
}

// 686 must create exactly its eight tables. A ninth would be a scope change
// after application and needs its own version number.
func TestMigration_TicketDomain_CreatesExactlyTheEightOwnedTables(t *testing.T) {
	created := tkTables686(t)
	if len(created) != len(tkOwnedRelations) {
		t.Errorf("%s creates %d tables, want %d: %v",
			tkMigrationFile, len(created), len(tkOwnedRelations), tkSortedTableNames(created))
	}
	for _, table := range tkOwnedRelations {
		if _, ok := created[table]; !ok {
			t.Errorf("%s no longer creates %s", tkMigrationFile, table)
		}
	}
}

// Every owned relation is really used by the repository, so 686 creates nothing
// dead.
func TestMigration_TicketDomain_RepositoryAddressesEveryOwnedRelation(t *testing.T) {
	named := tkRelationsNamedByRepository()
	if len(named) == 0 {
		t.Fatal("no relation found in the repository, so the detector is reading the wrong directory")
	}
	t.Logf("repository addresses %d relation(s): %v", len(named), named)
	for _, table := range tkOwnedRelations {
		if !containsStr(named, table) {
			t.Errorf("repository no longer addresses %s, so %s creates an unused table", table, tkMigrationFile)
		}
	}
}

// The R38 boundary: a discard or stub in a repository method that no route
// reaches is dead code, so 686 must not ship a table for it. Creating one would
// ship schema nobody can populate, and the handler is still unmounted.
func TestMigration_TicketDomain_RecordOnlyRelationsAreNotClaimed(t *testing.T) {
	created := tkTables686(t)
	for _, table := range tkRelationsNotClaimed {
		if _, ok := created[table]; ok {
			t.Errorf("%s must not CREATE TABLE %s: the repository method that addresses it has no mounted route",
				tkMigrationFile, table)
		}
	}
}

// Both INSERT forms are positional and named, so every column they list must
// exist in the DDL. sqlx and the driver fail the whole statement on one missing
// column.
func TestMigration_TicketDomain_InsertColumnsExistInTheDDL(t *testing.T) {
	src := tkRepositorySource()
	schema := tkTables686(t)
	for _, table := range tkOwnedRelations {
		ins := tkInsertStatements(src, table)
		if len(ins) == 0 {
			t.Errorf("no INSERT INTO %s parsed from the repository, so the detector is wrong", table)
			continue
		}
		total := 0
		for _, cols := range ins {
			total += len(cols)
			for _, c := range columnsNotDeclared(schema[table], cols) {
				t.Errorf("INSERT INTO %s writes %s, which %s does not declare", table, c, tkMigrationFile)
			}
		}
		t.Logf("INSERT INTO %s: %d statement(s), %d column reference(s) checked", table, len(ins), total)
	}
}

// A struct field with no column is harmless: it simply stays at its zero value.
// This direction is asserted only so a typo in a db tag is still caught.
func TestMigration_TicketDomain_ModelTagsResolveAgainstTheDDL(t *testing.T) {
	schema := tkTables686(t)
	for _, pair := range tkSelectStar {
		tags := tkDbTags(pair.typ)
		if len(tags) == 0 {
			t.Fatalf("no db tags parsed for %s, so the detector is wrong", pair.typ)
		}
		for _, c := range tags {
			if !schema[pair.table][c] {
				t.Errorf("models.%s db:%q has no column in %s", pair.typ, c, pair.table)
			}
		}
		t.Logf("models.%s declares %d db tag(s) against %s's %d column(s)",
			pair.typ, len(tags), pair.table, len(schema[pair.table]))
	}
}

// TestMigration_TicketDomain_SelectStarColumnsAllHaveADestinationField
//
// The assertion that caught the defect this round. sqlx@v1.4.0 StructScan
// (sqlx.go:609) calls m.TraversalsByName(v.Type(), columns) over the result
// columns and then returns missingFields(r.fields), which is the first column
// with no traversal. In safe mode -- and .Unsafe() appears nowhere in this
// repo -- that becomes `missing destination name <column> in <T>` and the call
// fails. So a DDL column without a destination field is fatal in both
// directions of the mismatch: omit the column and the query cannot run, add it
// without the field and every read fails.
//
// sla_targets.tenant_id is the instance. sla_policy.go filters its compliance
// JOIN on t.tenant_id, so the column had to exist, and once it did the two
// SELECT * queries in sla.go would have answered 500 for every target. Adding
// TenantID to models.SLATarget is the only change that satisfies both sides.
func TestMigration_TicketDomain_SelectStarColumnsAllHaveADestinationField(t *testing.T) {
	schema := tkTables686(t)
	for _, pair := range tkSelectStar {
		tags := tkDbTags(pair.typ)
		if len(tags) == 0 {
			t.Fatalf("no db tags parsed for %s, so the detector is wrong", pair.typ)
		}
		missing := tkColumnsWithoutDestination(schema[pair.table], tags)
		if len(missing) != 0 {
			t.Errorf("SELECT * FROM %s into models.%s: column(s) %v have no db destination field, "+
				"so sqlx safe mode rejects every read of the relation", pair.table, pair.typ, missing)
		}
	}
}

// Every NOT NULL column an INSERT omits needs a DEFAULT, because the
// repositories never fill created_at or updated_at.
func TestMigration_TicketDomain_OmittedNotNullColumnsHaveADefault(t *testing.T) {
	src := tkRepositorySource()
	for _, table := range tkOwnedRelations {
		notNull, hasDefault := tkColumnDefs(tkCreateTableBody(t, table))
		for _, cols := range tkInsertStatements(src, table) {
			written := map[string]bool{}
			for _, c := range cols {
				written[c] = true
			}
			for col := range notNull {
				if written[col] || hasDefault[col] {
					continue
				}
				t.Errorf("INSERT INTO %s omits %s, which is NOT NULL with no DEFAULT, so the statement fails",
					table, col)
			}
		}
	}
}

// tickets.id is UUID while every one of these models keys on TEXT, so a
// foreign key to tickets would fail CREATE TABLE. The relation is enforced in
// application code instead.
func TestMigration_TicketDomain_DoesNotReferenceTickets(t *testing.T) {
	body := migrationBody(t, tkMigrationFile)
	if strings.Contains(strings.ToLower(body), "references tickets") {
		t.Errorf("%s references tickets(id), but tickets.id is UUID while every one of these "+
			"models keys on string/TEXT, so CREATE TABLE would fail", tkMigrationFile)
	}
	// A column-type match, not a word match: the header explains the
	// deliberate non-FK decision in prose, so a bare \buuid\b would trip on that comment.
	if reMust(`(?im)^\s*[a-z_][a-z0-9_]*\s+uuid\b`).MatchString(body) {
		t.Errorf("%s declares a UUID column, which would mismatch the string ids the repositories write",
			tkMigrationFile)
	}
}

// DispatchQueueEntry has no id field, and Enqueue relies on
// ON CONFLICT (ticket_id) DO NOTHING, which needs a unique constraint on
// ticket_id. Making ticket_id the primary key satisfies both.
func TestMigration_TicketDomain_DispatchQueuePrimaryKeyIsTicketID(t *testing.T) {
	src := tkRepositorySource()
	if !reMust(`(?i)ON CONFLICT\s*\(\s*ticket_id\s*\)\s*DO NOTHING`).MatchString(src) {
		t.Skip("Enqueue no longer relies on ON CONFLICT (ticket_id); the primary-key choice may change")
	}
	body := tkCreateTableBody(t, "dispatch_queue")
	if !reMust(`(?i)ticket_id\s+TEXT\s+PRIMARY KEY`).MatchString(body) {
		t.Error("dispatch_queue must make ticket_id the primary key: DispatchQueueEntry has no id " +
			"field and ON CONFLICT (ticket_id) DO NOTHING needs a unique constraint on ticket_id")
	}
}

// Tenancy is absent on purpose where no writer exists. A permanently NULL
// tenant_id plus a WHERE tenant_id predicate turns every legitimate read into
// not-found, including for the caller who is entitled to the row.
func TestMigration_TicketDomain_TenantColumnsAreWhereAWriterOrAJoinExists(t *testing.T) {
	schema := tkTables686(t)
	for _, table := range []string{"sla_records", "suspend_records", "ticket_comments"} {
		if schema[table]["tenant_id"] {
			t.Errorf("%s declares tenant_id on %s, but no repository writes it: the column would stay "+
				"NULL forever and any WHERE tenant_id predicate would hide every row", table, table)
		}
	}
	if !schema["dispatch_queue"]["tenant_id"] {
		t.Error("dispatch_queue dropped tenant_id, which Enqueue writes and Dequeue filters on")
	}
	if !schema["sla_targets"]["tenant_id"] {
		t.Error("sla_targets dropped tenant_id, which sla_policy.go's compliance JOIN filters on")
	}
}

func TestMigration_TicketDomain_DownDropsAllEightInDependencyOrder(t *testing.T) {
	down := tkMigrationFile[:len(tkMigrationFile)-len(".sql")] + "_down.sql"
	body := migrationBody(t, down)
	for _, table := range tkOwnedRelations {
		if !strings.Contains(body, "DROP TABLE IF EXISTS "+table) {
			t.Errorf("%s does not drop %s", down, table)
		}
	}
	// sla_records carries the only foreign key in the set, so it must go before
	// sla_targets or the drop fails on the dependent object.
	i := strings.Index(body, "DROP TABLE IF EXISTS sla_records")
	j := strings.Index(body, "DROP TABLE IF EXISTS sla_targets")
	if i == -1 || j == -1 {
		t.Fatalf("%s does not drop both sla tables", down)
	}
	if i > j {
		t.Errorf("%s drops sla_targets before sla_records, which fails on the foreign key", down)
	}
}

// Two files under one version number apply at the same step, and the later one
// overwrites the earlier. The assertions read tkMigrationFile so a repeat
// collision forces an edit here.
func TestMigration_TicketDomain_VersionIsUnique(t *testing.T) {
	const version = "686"
	forwards := []string{}
	downs := []string{}
	for _, f := range entriesInMigrationsDir() {
		if !strings.HasPrefix(f.name, version+"_") {
			continue
		}
		if strings.HasSuffix(f.name, "_down.sql") {
			downs = append(downs, f.name)
		} else {
			forwards = append(forwards, f.name)
		}
	}
	sort.Strings(forwards)
	sort.Strings(downs)
	t.Logf("version %s: forwards=%v downs=%v", version, forwards, downs)
	if len(forwards) != 1 {
		t.Errorf("version %s has %d forward migration(s): %v", version, len(forwards), forwards)
	}
	if len(downs) != 1 {
		t.Errorf("version %s has %d down migration(s): %v", version, len(downs), downs)
	}
	if len(forwards) == 1 && forwards[0] != tkMigrationFile {
		t.Errorf("version %s resolves to %s, want %s", version, forwards[0], tkMigrationFile)
	}
}

// The bijection checker must report a column that has no destination field, or
// the assertion above would pass against a broken schema.
func TestMigration_TicketDomain_SelectStarCheckerIsNotVacuous(t *testing.T) {
	cols := map[string]bool{"id": true, "name": true, "tenant_id": true}
	if got := tkColumnsWithoutDestination(cols, []string{"id", "name"}); len(got) != 1 || got[0] != "tenant_id" {
		t.Errorf("checker must report a column with no destination field, got %v", got)
	}
	if got := tkColumnsWithoutDestination(cols, []string{"id", "name", "tenant_id"}); len(got) != 0 {
		t.Errorf("checker must not report columns that do have a destination field, got %v", got)
	}
	// A stray field does not hide the missing one: the extra tag is ignored, the
	// undeclared column is still reported.
	if got := tkColumnsWithoutDestination(cols, []string{"id", "ghost"}); len(got) != 2 {
		t.Errorf("checker must still report both undeclared columns, got %v", got)
	}
}

// tkInsertStatements must see every INSERT, not just the first, or a later
// statement could write a column the DDL lacks and go unreported.
func TestMigration_TicketDomain_InsertStatementDetectorSeesEveryStatement(t *testing.T) {
	src := "INSERT INTO sla_targets (a, b) VALUES ($1,$2); INSERT INTO sla_targets (a, c) VALUES ($1,$2);"
	got := tkInsertStatements(src, "sla_targets")
	if len(got) != 2 {
		t.Fatalf("detector found %d INSERT(s), want 2: %v", len(got), got)
	}
	if len(got[1]) != 2 || got[1][1] != "c" {
		t.Errorf("detector misread the second INSERT: %v", got[1])
	}
}
