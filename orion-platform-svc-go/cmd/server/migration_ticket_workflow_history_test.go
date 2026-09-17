package main

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
)

// Round 61: ticket_workflow_history had two live writers and no tenant column.
//
// 076_create_ticketing_tables.sql created the table with nine columns and no
// tenant_id, yet both modules wrote and filtered on one:
//
//	internal/ticketing/repository/repository.go AddWorkflowHistory INSERTs
//	tenant_id; GetWorkflowHistory filters WHERE tenant_id=$1 AND ticket_id=$2.
//
// The other module went further and named four columns the CREATE statement
// never creates (from_status, to_status, performed_by, reason) while omitting
// two that are NOT NULL with no default (action, created_at). So every INSERT
// died in the driver, and every SELECT * read died one step earlier in sqlx
// safe mode: 571 and 572 add columns no model field claims, and StructScan
// returns missingFields for them, failing the whole call.
//
// 695_add_ticket_workflow_history_tenant.sql adds the missing column. This file
// pins the assembled column set against every INSERT and SELECT the two
// modules issue, in both directions, so a regression fails here instead of at
// the driver.

const (
	whTable     = "ticket_workflow_history"
	whCreator   = "076_create_ticketing_tables.sql"
	whMigration = "695_add_ticket_workflow_history_tenant.sql"
	whDown      = "695_add_ticket_workflow_history_tenant_down.sql"
	whVersion   = "695"
)

// A Go SQL literal is "..." or `...`, and neither may contain the other's
// delimiter, so a select list cannot run on past the statement that owns it.
const whLitBreak = ";\"`"

// reWhAlter matches ALTER TABLE ticket_workflow_history ADD [COLUMN]
// [IF NOT EXISTS] <col> .... The optional IF NOT EXISTS is why 571, 572 and
// 695 all match; the trailing [^;]* keeps the clause so the NOT NULL and
// DEFAULT assertions can read it.
var reWhAlter = regexp.MustCompile(`(?is)ALTER\s+TABLE\s+` + regexp.QuoteMeta(whTable) +
	`\s+ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\b[^;]*`)

// reWhSelect returns the selected column list and the predicate between FROM
// and ORDER BY for one read of the table.
var reWhSelect = regexp.MustCompile("(?is)SELECT\\s+([^" + whLitBreak + "]*?)(?:FROM|WHERE)\\s+" +
	regexp.QuoteMeta(whTable) + "\\s+([^" + whLitBreak + "]*?)(?:ORDER\\s+BY|LIMIT|;|$)")

// reWhHandlerCall pins the first argument of the handler's read call, which is
// where the tenant boundary must come from.
var reWhHandlerCall = regexp.MustCompile(`h\.svc\.GetWorkflowHistory\(\s*ctx\s*,\s*(\w+)`)

// whModule pairs a module with the source its statements live in. The service
// directory is included as well so a raw query smuggled into a handler or
// service cannot read the table unscoped.
type whModule struct {
	name string
	sql  string
}

func whModules() []whModule {
	return []whModule{
		{"internal/ticket", tkDirSource("../../internal/ticket/repository") + tkDirSource("../../internal/ticket/service")},
		{"internal/ticketing", tkDirSource("../../internal/ticketing/repository") + tkDirSource("../../internal/ticketing/service")},
	}
}

// whSchema is ticket_workflow_history as it stands after every forward
// migration has been applied.
type whSchema struct {
	cols       map[string]bool
	notNull    map[string]bool
	hasDefault map[string]bool
	addedBy    map[string]string
}

func whSchemaFrom(files []migrationFile) whSchema {
	s := whSchema{
		cols:       map[string]bool{},
		notNull:    map[string]bool{},
		hasDefault: map[string]bool{},
		addedBy:    map[string]string{},
	}

	for _, f := range files {
		if f.name != whCreator {
			continue
		}
		m := reMust(`(?is)CREATE TABLE\s+IF NOT EXISTS\s+` + regexp.QuoteMeta(whTable) + `\s*\(([\s\S]*?)\);`).FindStringSubmatch(f.body)
		if m == nil {
			continue
		}
		nn, hd := tkColumnDefs(m[1])
		for c := range nn {
			s.notNull[c] = true
		}
		for c := range hd {
			s.hasDefault[c] = true
		}
		for _, line := range strings.Split(m[1], "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "--") {
				continue
			}
			fld := strings.Fields(line)
			if len(fld) < 2 {
				continue
			}
			switch strings.ToUpper(fld[0]) {
			case "PRIMARY", "UNIQUE", "CONSTRAINT", "FOREIGN", "CHECK", "INDEX":
				continue
			}
			col := strings.ToLower(fld[0])
			s.cols[col] = true
			s.addedBy[col] = f.name
		}
	}

	for _, f := range files {
		if strings.HasSuffix(f.name, "_down.sql") || f.name == whCreator {
			continue
		}
		for _, m := range reWhAlter.FindAllStringSubmatch(f.body, -1) {
			col := m[1]
			s.cols[col] = true
			s.addedBy[col] = f.name
			// An ADD COLUMN without NOT NULL is nullable, and a NOT NULL addition
			// to a table that already holds rows fails unless it also carries a
			// DEFAULT, so the two must be read together.
			if !strings.Contains(strings.ToUpper(m[0]), "NOT NULL") {
				continue
			}
			s.notNull[col] = true
			if reTkDefault.MatchString(m[0]) {
				s.hasDefault[col] = true
			}
		}
	}
	return s
}

func whFinalSchema() whSchema { return whSchemaFrom(entriesInMigrationsDir()) }

// whSchemaWithout695 is the same corpus with this round's migration removed. The
// non-vacuity test compares it against whFinalSchema to prove the assertions
// depend on 695 rather than on the CREATE TABLE alone.
func whSchemaWithout695() whSchema {
	out := []migrationFile{}
	for _, f := range entriesInMigrationsDir() {
		if strings.HasPrefix(f.name, whVersion+"_") {
			continue
		}
		out = append(out, f)
	}
	return whSchemaFrom(out)
}

func whSplitList(s string) []string {
	out := []string{}
	for _, c := range strings.Split(s, ",") {
		if c = strings.TrimSpace(strings.ToLower(c)); c != "" {
			out = append(out, c)
		}
	}
	return out
}

func sortedWhKeys(m map[string]bool) []string {
	out := []string{}
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// whRead is one read of the table.
type whRead struct {
	module    string
	columns   []string
	star      bool
	predicate string
}

func whReads() []whRead {
	var out []whRead
	for _, mod := range whModules() {
		for _, m := range reWhSelect.FindAllStringSubmatch(mod.sql, -1) {
			r := whRead{module: mod.name, predicate: strings.TrimSpace(m[2])}
			if strings.TrimSpace(m[1]) == "*" {
				r.star = true
			} else {
				r.columns = whSplitList(m[1])
			}
			out = append(out, r)
		}
	}
	return out
}

// whIsTenantScoped requires the tenant predicate, not just its absence of a
// wrong one: a predicate mentioning neither column is not tenant scoped either.
func whIsTenantScoped(predicate string) bool {
	return regexp.MustCompile(`(?i)\btenant_id\b`).MatchString(predicate) &&
		regexp.MustCompile(`(?i)\bticket_id\b`).MatchString(predicate)
}

// whDbTagsB reads the db tags of a struct in internal/ticketing/models, which
// tkDbTags cannot do because it is hard-wired to the other module.
func whDbTagsB(typ string) []string {
	src := tkDirSource("../../internal/ticketing/models")
	for _, m := range reStructBlock.FindAllStringSubmatch(src, -1) {
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

func TestMigration_TicketWorkflowHistory_CreatedByExactlyOneMigration(t *testing.T) {
	creators := []string{}
	re := reMust(`(?is)CREATE TABLE\s+(?:IF NOT EXISTS\s+)?` + regexp.QuoteMeta(whTable))
	for _, f := range entriesInMigrationsDir() {
		if strings.HasSuffix(f.name, "_down.sql") {
			continue
		}
		if re.MatchString(f.body) {
			creators = append(creators, f.name)
		}
	}
	sort.Strings(creators)
	if len(creators) != 1 || creators[0] != whCreator {
		t.Errorf("%s is created by %v, want exactly [%s]; a second creator silently redefines the columns", whTable, creators, whCreator)
	}
}

func TestMigration_TicketWorkflowHistory_TenantIDIsDeclaredBy695(t *testing.T) {
	s := whFinalSchema()
	if !s.cols["tenant_id"] {
		t.Fatalf("%s has no tenant_id column after every migration; columns: %v", whTable, sortedWhKeys(s.cols))
	}
	if s.notNull["tenant_id"] {
		t.Errorf("tenant_id must be nullable: a NOT NULL addition fails on a database that already holds rows")
	}
	if got := s.addedBy["tenant_id"]; got != whMigration {
		t.Errorf("tenant_id is added by %s, want %s", got, whMigration)
	}
	if got := s.addedBy["ticket_id"]; got != whCreator {
		t.Errorf("ticket_id should come from %s, got %s", whCreator, got)
	}

	// The CREATE statement alone must not be enough; this is the defect.
	if whSchemaWithout695().cols["tenant_id"] {
		t.Error("the schema without 695 already has tenant_id, so this assertion does not depend on the migration")
	}

	body := migrationBody(t, whMigration)
	if !strings.Contains(body, "ADD COLUMN IF NOT EXISTS tenant_id UUID") {
		t.Errorf("695 must add tenant_id as a nullable UUID and be idempotent; got:\n%s", body)
	}
	// tickets.tenant_id is UUID in 076, so the history row must match its type.
	if !strings.Contains(migrationBody(t, whCreator), "tenant_id UUID") {
		t.Error("tickets.tenant_id is no longer UUID in 076, so 695's type may not match")
	}
}

func TestMigration_TicketWorkflowHistory_InsertColumnsExistInTheDDL(t *testing.T) {
	s := whFinalSchema()
	total := 0
	for _, mod := range whModules() {
		total += len(tkInsertStatements(mod.sql, whTable))
	}
	if total == 0 {
		t.Fatal("no INSERT INTO " + whTable + " was parsed from either module, so the detector is wrong")
	}
	for _, mod := range whModules() {
		for _, cols := range tkInsertStatements(mod.sql, whTable) {
			if bad := columnsNotDeclared(s.cols, cols); len(bad) > 0 {
				t.Errorf("%s: INSERT INTO %s names columns the DDL does not create: %v", mod.name, whTable, bad)
			}
		}
	}
}

func TestMigration_TicketWorkflowHistory_NotNullColumnsAreWrittenOrDefaulted(t *testing.T) {
	s := whFinalSchema()
	required := []string{}
	for c := range s.notNull {
		if !s.hasDefault[c] {
			required = append(required, c)
		}
	}
	sort.Strings(required)
	if len(required) == 0 {
		t.Fatal("no NOT NULL column without a default was derived from the DDL, so this assertion is vacuous")
	}
	t.Logf("NOT NULL with no default: %v", required)

	for _, mod := range whModules() {
		for _, cols := range tkInsertStatements(mod.sql, whTable) {
			missing := []string{}
			for _, c := range required {
				if !containsStr(cols, c) {
					missing = append(missing, c)
				}
			}
			if len(missing) > 0 {
				t.Errorf("%s: INSERT INTO %s omits %v, which are NOT NULL with no default, so the driver rejects the row",
					mod.name, whTable, missing)
			}
		}
	}
}

func TestMigration_TicketWorkflowHistory_ReadsSelectColumnsThatExist(t *testing.T) {
	s := whFinalSchema()
	got := whReads()
	if len(got) == 0 {
		t.Fatal("no SELECT against " + whTable + " was parsed from either module, so the detector is wrong")
	}
	for _, r := range got {
		if r.star {
			t.Errorf("%s: SELECT * against %s must be an explicit column list: 571 and 572 add columns no model field claims, so safe mode rejects the whole read",
				r.module, whTable)
			continue
		}
		if bad := columnsNotDeclared(s.cols, r.columns); len(bad) > 0 {
			t.Errorf("%s: SELECT names columns the DDL does not create: %v", r.module, bad)
		}
	}
}

func TestMigration_TicketWorkflowHistory_SelectedColumnsHaveADestination(t *testing.T) {
	for _, r := range whReads() {
		if r.star {
			continue
		}
		var tags []string
		if strings.HasPrefix(r.module, "internal/ticketing") {
			tags = whDbTagsB("WorkflowHistoryEntry")
		} else {
			tags = tkDbTags("WorkflowHistory")
		}
		if tags == nil {
			t.Errorf("%s: scan target has no db tags to check against", r.module)
			continue
		}
		set := map[string]bool{}
		for _, c := range r.columns {
			set[c] = true
		}
		if missing := tkColumnsWithoutDestination(set, tags); len(missing) > 0 {
			t.Errorf("%s: SELECT returns %v but the scan target declares no destination for %v; sqlx@v1.4.0 StructScan fails the whole call",
				r.module, r.columns, missing)
		}
	}
}

func TestMigration_TicketWorkflowHistory_EveryReadAndWriteIsTenantScoped(t *testing.T) {
	got := whReads()
	if len(got) == 0 {
		t.Fatal("no SELECT parsed, so the tenant assertion is vacuous")
	}
	for _, mod := range whModules() {
		if mod.sql == "" {
			t.Errorf("no source was read from %s, so that module is untested", mod.name)
		}
	}
	for _, r := range got {
		if !whIsTenantScoped(r.predicate) {
			t.Errorf("%s: read of %s is not tenant scoped: %q", r.module, whTable, r.predicate)
		}
	}
	for _, mod := range whModules() {
		for _, cols := range tkInsertStatements(mod.sql, whTable) {
			if !containsStr(cols, "tenant_id") {
				t.Errorf("%s: INSERT INTO %s does not write tenant_id, so the rows it creates cannot be read back by tenant",
					mod.name, whTable)
			}
		}
	}
}

func TestMigration_TicketWorkflowHistory_HandlerPassesTheTenantID(t *testing.T) {
	src := tkDirSource("../../internal/ticket/handler")
	if src == "" {
		t.Fatal("no handler source was read from internal/ticket/handler")
	}
	m := reWhHandlerCall.FindStringSubmatch(src)
	if m == nil {
		t.Fatal("h.svc.GetWorkflowHistory is not called in internal/ticket/handler")
	}
	if m[1] != "tenantID" {
		t.Errorf("GetWorkflowHistory's first argument is %s, want tenantID: keyed on ticket id alone any tenant can read another tenant's history by guessing an id", m[1])
	}
	if !strings.Contains(src, `c.GetString("tenant_id")`) {
		t.Error("the handler never reads tenant_id from the request context")
	}
}

func TestMigration_TicketWorkflowHistory_ModelTagsResolveAgainstTheDDL(t *testing.T) {
	s := whFinalSchema()
	tags := tkDbTags("WorkflowHistory")
	if tags == nil {
		t.Fatal("no db tags found for internal/ticket/models.WorkflowHistory")
	}
	if bad := columnsNotDeclared(s.cols, tags); len(bad) > 0 {
		t.Errorf("WorkflowHistory db tags name columns the DDL does not create: %v", bad)
	}
}

func TestMigration_TicketWorkflowHistory_VersionIsUnique(t *testing.T) {
	forwards, downs := []string{}, []string{}
	for _, f := range entriesInMigrationsDir() {
		if !strings.HasPrefix(f.name, whVersion+"_") {
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
	if len(forwards) != 1 || forwards[0] != whMigration {
		t.Errorf("version %s has forwards %v, want exactly [%s]", whVersion, forwards, whMigration)
	}
	if len(downs) != 1 || downs[0] != whDown {
		t.Errorf("version %s has downs %v, want exactly [%s]", whVersion, downs, whDown)
	}

	max := 0
	for _, f := range entriesInMigrationsDir() {
		var n int
		if _, err := fmt.Sscanf(f.name, "%d_", &n); err == nil && n > max {
			max = n
		}
	}
	// The ordering guarantee is "nothing was applied after 695 when it landed",
	// not "695 is still the last migration": the latter becomes false the moment
	// any later round adds a migration (696 in Round 62) and says nothing about
	// the ordering of this one.
	whInt, aerr := strconv.Atoi(whVersion)
	if aerr != nil {
		t.Fatalf("whVersion %q is not an integer: %v", whVersion, aerr)
	}
	if max < whInt {
		t.Errorf("the newest migration version is %d, so %s would apply after a later-numbered migration", max, whVersion)
	}
}

func TestMigration_TicketWorkflowHistory_DownReversesTheForwardInOrder(t *testing.T) {
	fwd := migrationBody(t, whMigration)
	down := migrationBody(t, whDown)

	reIdx := regexp.MustCompile(`(?i)CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+(\S+)\s+ON\s+` + regexp.QuoteMeta(whTable))
	idx := []string{}
	for _, m := range reIdx.FindAllStringSubmatch(fwd, -1) {
		idx = append(idx, m[1])
	}
	sort.Strings(idx)
	if len(idx) == 0 {
		t.Fatal("no index was parsed from 695, so the drop-order assertion is vacuous")
	}
	t.Logf("indexes created by %s: %v", whMigration, idx)

	for _, i := range idx {
		if !regexp.MustCompile(`(?i)DROP\s+INDEX\s+(?:IF\s+EXISTS|IF\s+NOT\s+EXISTS)\s+` + regexp.QuoteMeta(i) + `\b`).MatchString(down) {
			t.Errorf("the down migration does not drop index %s", i)
		}
	}
	if !regexp.MustCompile(`(?is)ALTER\s+TABLE\s+` + regexp.QuoteMeta(whTable) + `\s+DROP\s+COLUMN\s+(?:IF\s+EXISTS|IF\s+NOT\s+EXISTS)\s+tenant_id`).MatchString(down) {
		t.Error("the down migration does not drop tenant_id")
	}

	// The index depends on the column, so dropping the column first leaves an
	// index the migration cannot then drop.
	firstIdxAt := regexp.MustCompile(`(?i)DROP\s+INDEX\s+(?:IF\s+EXISTS|IF\s+NOT\s+EXISTS)\s+` + regexp.QuoteMeta(idx[0])).FindStringIndex(down)
	dropColAt := strings.Index(strings.ToLower(down), "drop column")
	if firstIdxAt == nil || dropColAt < 0 {
		t.Errorf("could not locate the index drop or the column drop in the down migration: index=%v col=%d", firstIdxAt, dropColAt)
	} else if dropColAt < firstIdxAt[0] {
		t.Error("the down migration drops tenant_id before the index on it, which fails while the index still exists")
	}
}

// TestMigration_TicketWorkflowHistory_DetectorsAreNotVacuous
//
// Every checker above is fed the statement the code used before this round and
// must report the defect. An assertion built on a checker that accepts a broken
// statement passes against a broken schema.
func TestMigration_TicketWorkflowHistory_DetectorsAreNotVacuous(t *testing.T) {
	s := whFinalSchema()
	if !s.cols["action"] || !s.notNull["action"] {
		t.Fatalf("action must be NOT NULL with no default in the DDL for the omission check to mean anything")
	}

	// 1. The pre-fix INSERT named four columns the CREATE never creates.
	preInsert := []string{"id", "ticket_id", "from_status", "to_status", "performed_by", "reason"}
	bad := columnsNotDeclared(s.cols, preInsert)
	sort.Strings(bad)
	for _, want := range []string{"from_status", "to_status", "performed_by", "reason"} {
		if !containsStr(bad, want) {
			t.Errorf("checker must report %s as undeclared, got %v", want, bad)
		}
	}

	// 2. ...and omitted two NOT NULL columns with no default.
	required := []string{}
	for c := range s.notNull {
		if !s.hasDefault[c] {
			required = append(required, c)
		}
	}
	sort.Strings(required)
	missing := []string{}
	for _, c := range required {
		if !containsStr(preInsert, c) {
			missing = append(missing, c)
		}
	}
	sort.Strings(missing)
	for _, want := range []string{"action", "created_at"} {
		if !containsStr(missing, want) {
			t.Errorf("checker must report the omitted NOT NULL column %s, got %v", want, missing)
		}
	}

	// 3. The pre-fix WHERE clause keyed on ticket_id alone.
	if whIsTenantScoped("WHERE ticket_id = $1 ") {
		t.Error("the predicate checker accepts a ticket-id-only WHERE, so the tenant assertion is vacuous")
	}
	if !whIsTenantScoped("WHERE tenant_id=$1 AND ticket_id=$2 ") {
		t.Error("the predicate checker rejects a tenant-scoped WHERE, so the assertion would fail on a correct statement")
	}

	// 4. The SELECT parser must still see the pre-fix SELECT * statement and must
	// report both its defect and the missing tenant predicate.
	preRead := `"SELECT * FROM ticket_workflow_history WHERE ticket_id = $1 ORDER BY created_at ASC"`
	m := reWhSelect.FindStringSubmatch(preRead)
	if m == nil {
		t.Fatal("the SELECT parser does not match the pre-fix statement, so the SELECT * check would never fire")
	}
	if strings.TrimSpace(m[1]) != "*" {
		t.Errorf("the parser read the select list as %q, want *", m[1])
	}
	if whIsTenantScoped(strings.TrimSpace(m[2])) {
		t.Error("the parser missed that the pre-fix predicate is not tenant scoped")
	}

	// 5. The ALTER parser must find each addition in the migration that owns it,
	// which is what makes addedBy worth asserting on.
	addedBy := map[string]string{}
	for _, f := range entriesInMigrationsDir() {
		if strings.HasSuffix(f.name, "_down.sql") {
			continue
		}
		for _, m := range reWhAlter.FindAllStringSubmatch(f.body, -1) {
			addedBy[m[1]] = f.name
		}
	}
	for col, want := range map[string]string{
		"deleted_at": "571_add_soft_delete.sql",
		"created_by": "572_add_audit_columns.sql",
		"updated_by": "572_add_audit_columns.sql",
		"updated_at": "572_add_audit_columns.sql",
		"tenant_id":  whMigration,
	} {
		if got := addedBy[col]; got != want {
			t.Errorf("the ALTER parser reports %s as added by %q, want %q (parsed: %v)", col, got, want, addedBy)
		}
	}

	// 6. The handler-call checker must fail on the pre-fix argument order.
	if m := reWhHandlerCall.FindStringSubmatch("h.svc.GetWorkflowHistory(ctx, id, \"x\")"); m == nil || m[1] != "id" {
		t.Errorf("the handler-call checker did not read %q as id, so the tenant argument assertion would not fire",
			"h.svc.GetWorkflowHistory(ctx, id)")
	}
}
