package main

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// Round 62: two live modules wrote to the same three 076 tables through two
// incompatible dialects.
//
//   internal/ticket      wired at wiring-core-domains.go:53-55, routes
//   /api/v1/tickets/...
//   internal/ticketing   wired at cicd_domain_wiring.go:354
//
// internal/ticket INSERTed type, created_by, assigned_to, related_ticket_id,
// relation_type, from_engineer_id and to_engineer_id - none of which
// 076_create_ticketing_tables.sql creates - while omitting reporter_id, which
// 076 declares NOT NULL with no default. internal/ticketing read the same table
// with SELECT *, which fails in sqlx safe mode because 571 / 572 add
// deleted_at, created_by and updated_by and models.Ticket has no destination
// for any of them. Every failure is a driver error, so the compiler never saw
// it and the routes answered 500 at runtime.
//
// 076 won the dialect war: internal/ticketing's live CreateTicket already wrote
// 076's names exactly, and its Round 61 comment states the no-SELECT-* rule.
//
// The three files that still spoke the old dialect
// (internal/ticketing/repository/{ticket,relation,transfer}.go) were deleted in
// this round: a liveness closure from every repository constructor to cmd/server
// showed no caller, and they were the origin of the phantom column names the
// live models had inherited. TestTkdDeadModuleBFilesAreGone keeps them deleted.
// ---------------------------------------------------------------------------

const (
	tkdModuleA = "internal/ticket"
	tkdModuleB = "internal/ticketing"
)

var tkdTables = []string{"tickets", "ticket_relations", "ticket_transfers"}

var (
	reTkdVersion = regexp.MustCompile(`^(\d+)_`)
	reTkdCreate  = regexp.MustCompile(`(?is)CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s*\((.*?)\)\s*;`)
	reTkdAddCol  = regexp.MustCompile(`(?is)\bALTER\s+TABLE\s+([a-z_][a-z0-9_]*)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)\s+([^;,]+)(?:;|,)`)
	reTkdDropNN  = regexp.MustCompile(`(?is)\bALTER\s+TABLE\s+([a-z_][a-z0-9_]*)\s+ALTER\s+COLUMN\s+([a-z_][a-z0-9_]*)\s+DROP\s+NOT\s+NULL`)
	reTkdNotNull = regexp.MustCompile(`(?i)\bNOT\s+NULL\b`)
	reTkdDefault = regexp.MustCompile(`(?i)\bDEFAULT\b`)
	reTkdInsert  = regexp.MustCompile(`(?is)INSERT\s+INTO\s+([a-z_][a-z0-9_]*)\s*\(([^)]*)\)\s*VALUES`)
	reTkdUpdate  = regexp.MustCompile(`(?is)\bUPDATE\s+([a-z_][a-z0-9_]*)\s+SET\s+(.*?)\s+WHERE\b`)
	reTkdSetCol  = regexp.MustCompile(`\b([a-z_][a-z0-9_]*)\s*=`)
	reTkdStar    = regexp.MustCompile(`(?is)\bSELECT\s+\*\s+FROM\s+["']?(tickets|ticket_relations|ticket_transfers)["']?\b`)
	reTkdAs      = regexp.MustCompile(`(?is)\bAS\s+([a-z0-9_]+)\s*$`)
	reTkdDbTag   = regexp.MustCompile(`db:"([a-z_][a-z0-9_]*)"`)
	reTkdConstr  = regexp.MustCompile(`^(PRIMARY|UNIQUE|FOREIGN|CHECK|CONSTRAINT|INDEX|KEY|EXCLUDE|REFERENCES)\b`)
)

// tkdSchema is the final shape of one table after every forward migration has
// run in version order. notNullOnly holds the columns that are NOT NULL with no
// DEFAULT, which are exactly the ones an INSERT must supply.
type tkdSchema struct {
	columns     map[string]bool
	notNullOnly map[string]bool
}

func tkdNewSchema() *tkdSchema {
	return &tkdSchema{columns: map[string]bool{}, notNullOnly: map[string]bool{}}
}

func tkdNotNullNoDefault(def string) bool {
	return reTkdNotNull.MatchString(def) && !reTkdDefault.MatchString(def)
}

// tkdStripComments removes "--" line comments while leaving "--" inside a quoted
// literal alone, so a quoted value cannot hide or fake a statement.
func tkdStripComments(body string) string {
	var out []string
	for _, line := range strings.Split(body, "\n") {
		quoted, cut := false, -1
		for i := 0; i < len(line); i++ {
			if line[i] == '\'' {
				quoted = !quoted
				continue
			}
			if !quoted && i+1 < len(line) && line[i] == '-' && line[i+1] == '-' {
				cut = i
				break
			}
		}
		if cut >= 0 {
			line = line[:cut]
		}
		out = append(out, line)
	}
	return strings.Join(out, "\n")
}

// tkdVersion orders migrations by their leading version number.
// tkdOneline collapses every run of whitespace, because the DDL in this repo
// wraps long ALTER TABLE statements across lines and a raw Contains on the
// statement text misses them.
func tkdOneline(s string) string {
	return strings.Join(strings.Fields(s), " ")
}

func tkdVersion(name string) int {
	if m := reTkdVersion.FindStringSubmatch(name); m != nil {
		n, _ := strconv.Atoi(m[1])
		return n
	}
	return -1
}

// tkdSchemas folds every forward migration in migrations/ into a final schema
// for the three tables this round owns.
func tkdSchemas(t *testing.T) map[string]*tkdSchema {
	t.Helper()
	files := entriesInMigrationsDir()
	if len(files) == 0 {
		t.Fatal("no migrations found; the schema check would be vacuous")
	}
	sort.Slice(files, func(i, j int) bool {
		return tkdVersion(files[i].name) < tkdVersion(files[j].name)
	})

	schemas := map[string]*tkdSchema{}
	for _, f := range files {
		if strings.Contains(f.name, "_down") {
			continue
		}
		body := tkdStripComments(f.body)
		for _, m := range reTkdCreate.FindAllStringSubmatch(body, -1) {
			s := schemas[m[1]]
			if s == nil {
				s = tkdNewSchema()
				schemas[m[1]] = s
			}
			for _, raw := range strings.Split(m[2], "\n") {
				line := strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(raw), ";"))
				if line == "" {
					continue
				}
				fields := strings.Fields(line)
				if reTkdConstr.MatchString(fields[0]) {
					continue
				}
				col := strings.Trim(fields[0], "\"`")
				if col == "" || s.columns[col] {
					continue
				}
				s.columns[col] = true
				if tkdNotNullNoDefault(strings.Join(fields[1:], " ")) {
					s.notNullOnly[col] = true
				}
			}
		}
		for _, m := range reTkdAddCol.FindAllStringSubmatch(body, -1) {
			s := schemas[m[1]]
			if s == nil {
				s = tkdNewSchema()
				schemas[m[1]] = s
			}
			if !s.columns[m[2]] {
				s.columns[m[2]] = true
				if tkdNotNullNoDefault(m[3]) {
					s.notNullOnly[m[2]] = true
				}
			}
		}
		for _, m := range reTkdDropNN.FindAllStringSubmatch(body, -1) {
			if s := schemas[m[1]]; s != nil {
				delete(s.notNullOnly, m[2])
			}
		}
	}
	for _, tbl := range tkdTables {
		if _, ok := schemas[tbl]; !ok {
			t.Fatalf("no migration creates %s", tbl)
		}
	}
	return schemas
}

// tkdSrc is one Go source file plus its path relative to the repo root.
type tkdSrc struct {
	path string
	body string
}

// tkdModuleSources reads every non-test .go file in one module.
func tkdModuleSources(t *testing.T, module string) []tkdSrc {
	t.Helper()
	dir := filepath.Join("..", "..", module)
	var out []tkdSrc
	err := filepath.Walk(dir, func(p string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return err
		}
		if !strings.HasSuffix(p, ".go") || strings.HasSuffix(p, "_test.go") {
			return nil
		}
		b, rerr := os.ReadFile(p)
		if rerr != nil {
			return rerr
		}
		out = append(out, tkdSrc{path: p, body: string(b)})
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(out) == 0 {
		t.Fatalf("no sources found under %s", dir)
	}
	return out
}

func tkdIsTicketTable(name string) bool {
	for _, t := range tkdTables {
		if name == t {
			return true
		}
	}
	return false
}

type tkdStmt struct {
	path  string
	table string
	cols  []string
}

// tkdInserts returns the column list of every INSERT against the three tables.
func tkdInserts(sources []tkdSrc) []tkdStmt {
	var out []tkdStmt
	for _, src := range sources {
		for _, m := range reTkdInsert.FindAllStringSubmatch(src.body, -1) {
			if !tkdIsTicketTable(m[1]) {
				continue
			}
			var cols []string
			for _, c := range strings.Split(m[2], ",") {
				c = strings.Trim(strings.TrimSpace(c), "`\"")
				if c != "" {
					cols = append(cols, c)
				}
			}
			out = append(out, tkdStmt{src.path, m[1], cols})
		}
	}
	return out
}

// tkdUpdates returns the SET column names of every literal UPDATE against the
// three tables. Dynamically built SET clauses (joinSQL) yield no literal
// columns and are skipped, not failed.
func tkdUpdates(sources []tkdSrc) []tkdStmt {
	var out []tkdStmt
	for _, src := range sources {
		for _, m := range reTkdUpdate.FindAllStringSubmatch(src.body, -1) {
			if !tkdIsTicketTable(m[1]) {
				continue
			}
			var cols []string
			for _, c := range reTkdSetCol.FindAllStringSubmatch(m[2], -1) {
				cols = append(cols, c[1])
			}
			if len(cols) == 0 {
				continue
			}
			out = append(out, tkdStmt{src.path, m[1], cols})
		}
	}
	return out
}

// tkdSelectColumns reduces a SELECT list to the destination names the driver
// must scan into, skipping aggregates and resolving "expr AS name".
func tkdSelectColumns(list string) []string {
	var items []string
	depth := 0
	var cur strings.Builder
	for _, r := range list {
		switch {
		case r == '(':
			depth++
			cur.WriteRune(r)
		case r == ')':
			depth--
			cur.WriteRune(r)
		case r == ',' && depth == 0:
			if s := strings.TrimSpace(cur.String()); s != "" {
				items = append(items, s)
			}
			cur.Reset()
		default:
			cur.WriteRune(r)
		}
	}
	if s := strings.TrimSpace(cur.String()); s != "" {
		items = append(items, s)
	}
	var out []string
	for _, item := range items {
		item = strings.TrimSpace(item)
		if strings.HasPrefix(strings.ToUpper(item), "COUNT(") {
			continue
		}
		if m := reTkdAs.FindStringSubmatch(item); m != nil {
			out = append(out, strings.Trim(m[1], "`\""))
			continue
		}
		out = append(out, strings.Trim(item, "`\""))
	}
	return out
}

// tkdDbTagsOfStruct returns the db destinations of one struct.
func tkdDbTagsOfStruct(t *testing.T, module, structName string) map[string]bool {
	t.Helper()
	tags := map[string]bool{}
	dir := filepath.Join("..", "..", module, "models")
	err := filepath.Walk(dir, func(p string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() || !strings.HasSuffix(p, ".go") {
			return err
		}
		b, rerr := os.ReadFile(p)
		if rerr != nil {
			return rerr
		}
		body := string(b)
		start := strings.Index(body, "type "+structName+" struct {")
		if start < 0 {
			return nil
		}
		depth, end := 0, -1
		for i := start; i < len(body); i++ {
			switch body[i] {
			case '{':
				depth++
			case '}':
				depth--
				if depth == 0 {
					end = i
				}
			}
			if end >= 0 {
				break
			}
		}
		if end < 0 {
			return nil
		}
		for _, m := range reTkdDbTag.FindAllStringSubmatch(body[start:end+1], -1) {
			tags[m[1]] = true
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(tags) == 0 {
		t.Fatalf("no db tags found on %s.models.%s", module, structName)
	}
	return tags
}

// tkdProjections names every explicit SELECT projection this round introduced
// and the struct the driver scans it into.
var tkdProjections = []struct {
	file       string
	constName  string
	table      string
	module     string
	structName string
	// omit names a struct field this projection deliberately never selects.
	// Every entry must have a reason in the projection's own comment; an
	// unlisted field that the projection also skips means the model grew a
	// field nobody reads back into it.
	omit []string
}{
	{filepath.Join("internal/ticket/repository/ticket.go"), "ticketColumns", "tickets", tkdModuleA, "Ticket", nil},
	// created_by is 572's UUID REFERENCES users(id); pre-572 rows hold NULL and
	// NULL does not scan into a string, and no method receives an authenticated
	// user id to write.
	{filepath.Join("internal/ticket/repository/relation.go"), "relationColumns", "ticket_relations", tkdModuleA, "TicketRelation", []string{"created_by"}},
	{filepath.Join("internal/ticket/repository/transfer.go"), "transferColumns", "ticket_transfers", tkdModuleA, "TransferRecord", nil},
	// type and assigned_to are struct fields with no column in 076, so they
	// cannot be selected; created_by is the same NULL-scan case as above.
	{filepath.Join("internal/ticketing/repository/repository.go"), "ticketColumns", "tickets", tkdModuleB, "Ticket", []string{"type", "assigned_to", "created_by"}},
	{filepath.Join("internal/ticketing/repository/repository.go"), "relationColumns", "ticket_relations", tkdModuleB, "TicketRelation", []string{"related_ticket_id", "relation_type", "created_by"}},
}

func tkdProjectionValue(t *testing.T, relPath, constName string) string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("..", "..", relPath))
	if err != nil {
		t.Fatalf("%s: %v", relPath, err)
	}
	re := regexp.MustCompile(`(?s)const\s+` + constName + `\s*=\s*"((?:[^"\\]|\\.)*)"`)
	if m := re.FindStringSubmatch(string(b)); m != nil {
		return m[1]
	}
	t.Fatalf("%s does not define const %s", relPath, constName)
	return ""
}

// --- 696 -------------------------------------------------------------------

func TestTkdMigration696AddsTheColumnsTheRepositoriesWrite(t *testing.T) {
	fwd := migrationBody(t, "696_add_ticket_relation_transfer_columns.sql")
	down := migrationBody(t, "696_add_ticket_relation_transfer_columns_down.sql")

	for _, want := range []string{
		"ALTER TABLE ticket_relations ADD COLUMN IF NOT EXISTS description TEXT",
		"ALTER TABLE ticket_relations ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION NOT NULL DEFAULT 0",
		"ALTER TABLE ticket_transfers ADD COLUMN IF NOT EXISTS initiated_by VARCHAR(255)",
		"ALTER TABLE ticket_transfers ADD COLUMN IF NOT EXISTS hold_duration_ms BIGINT",
		"ALTER TABLE ticket_relations ALTER COLUMN tenant_id DROP NOT NULL",
	} {
		if !strings.Contains(tkdOneline(tkdStripComments(fwd)), want) {
			t.Errorf("696 forward does not contain %q", want)
		}
	}
	// Idempotent by construction: every ADD COLUMN is guarded.
	if n := strings.Count(fwd, "ADD COLUMN"); n != strings.Count(fwd, "ADD COLUMN IF NOT EXISTS") {
		t.Errorf("696 forward has %d ADD COLUMN and %d guarded ones",
			n, strings.Count(fwd, "ADD COLUMN IF NOT EXISTS"))
	}

	// The down migration must reverse exactly what the forward did.
	for _, want := range []string{
		"DROP COLUMN IF EXISTS hold_duration_ms",
		"DROP COLUMN IF EXISTS initiated_by",
		"DROP COLUMN IF EXISTS confidence",
		"DROP COLUMN IF EXISTS description",
		"ALTER TABLE ticket_relations ALTER COLUMN tenant_id SET NOT NULL",
	} {
		if !strings.Contains(tkdOneline(tkdStripComments(down)), want) {
			t.Errorf("696 down does not contain %q", want)
		}
	}
}

// --- INSERT columns exist --------------------------------------------------

func TestTkdBothModulesInsertOnlyColumnsTheSchemaHas(t *testing.T) {
	schemas := tkdSchemas(t)
	total := 0
	for _, module := range []string{tkdModuleA, tkdModuleB} {
		inserts := tkdInserts(tkdModuleSources(t, module))
		if len(inserts) == 0 {
			t.Fatalf("%s: no INSERT against a ticket table found; the check would be vacuous", module)
		}
		total += len(inserts)
		for _, ins := range inserts {
			for _, col := range ins.cols {
				if !schemas[ins.table].columns[col] {
					t.Errorf("%s INSERT into %s names %q, which no migration creates", ins.path, ins.table, col)
				}
			}
		}
	}
	if total < 3 {
		t.Fatalf("only %d ticket-table INSERTs found across both modules; expected at least one per table", total)
	}
}

// --- every NOT NULL column is supplied -------------------------------------
// This is the direction the pre-existing scanner never checked: it only asked
// "does this INSERT column exist", never "did this INSERT supply the columns the
// table requires". reporter_id is NOT NULL with no default in 076 and
// internal/ticket never supplied it, so every POST /api/v1/tickets failed in the
// driver even though every column it did name existed.

func TestTkdBothModulesSupplyEveryNotNullColumn(t *testing.T) {
	schemas := tkdSchemas(t)
	checked := 0
	for _, module := range []string{tkdModuleA, tkdModuleB} {
		for _, ins := range tkdInserts(tkdModuleSources(t, module)) {
			supplied := map[string]bool{}
			for _, c := range ins.cols {
				supplied[c] = true
			}
			for col := range schemas[ins.table].notNullOnly {
				if !supplied[col] {
					t.Errorf("%s INSERT into %s omits %q, which the schema declares NOT NULL with no default",
						ins.path, ins.table, col)
				}
			}
			checked++
		}
	}
	if checked < 4 {
		t.Fatalf("only %d INSERTs examined; expected at least 4 (tickets, relations and transfers from internal/ticket plus tickets and relations from internal/ticketing)", checked)
	}

	// Positive controls: the schema really does report required columns, and
	// ticket_relations.tenant_id is no longer one of them after 696 relaxed it.
	if len(schemas["tickets"].notNullOnly) == 0 {
		t.Fatal("tickets reports no NOT NULL column; the check would be vacuous")
	}
	if !schemas["tickets"].notNullOnly["reporter_id"] {
		t.Fatal("tickets.notNullOnly does not contain reporter_id; the check would be vacuous")
	}
	if schemas["ticket_relations"].notNullOnly["tenant_id"] {
		t.Fatal("ticket_relations.tenant_id is still NOT NULL after 696 relaxed it")
	}
	if !schemas["ticket_relations"].notNullOnly["related_id"] {
		t.Fatal("ticket_relations.related_id should still be NOT NULL")
	}
}

// --- no SELECT * -----------------------------------------------------------

func TestTkdNeitherModuleSelectsStarFromATicketTable(t *testing.T) {
	for _, module := range []string{tkdModuleA, tkdModuleB} {
		for _, src := range tkdModuleSources(t, module) {
			for _, m := range reTkdStar.FindAllStringSubmatch(src.body, -1) {
				t.Errorf("%s runs SELECT * FROM %s; sqlx safe mode rejects it because 571 / 572 add columns the model has no destination for",
					src.path, m[1])
			}
		}
	}
	// Positive controls: the matcher must not flag aggregates, which is how an
	// earlier draft of this test false-positived on SELECT COUNT(*).
	if reTkdStar.MatchString("SELECT COUNT(*) FROM tickets WHERE tenant_id=$1") {
		t.Fatal("the SELECT * matcher flags COUNT(*); the check would false-positive")
	}
	if !reTkdStar.MatchString("SELECT * FROM tickets WHERE id=$1") {
		t.Fatal("the SELECT * matcher missed a real SELECT *; the check is vacuous")
	}
}

// --- UPDATE SET columns exist ----------------------------------------------

func TestTkdBothModulesUpdateOnlyColumnsTheSchemaHas(t *testing.T) {
	schemas := tkdSchemas(t)
	updates := tkdUpdates(tkdModuleSources(t, tkdModuleA))
	if len(updates) == 0 {
		t.Fatal("no literal UPDATE against a ticket table found in internal/ticket; the check would be vacuous")
	}
	for _, u := range updates {
		for _, col := range u.cols {
			if !schemas[u.table].columns[col] {
				t.Errorf("%s UPDATE %s SET %q, which no migration creates", u.path, u.table, col)
			}
		}
	}
	if len(updates) < 4 {
		t.Fatalf("only %d literal ticket-table UPDATEs found in internal/ticket; expected the CRUD set", len(updates))
	}
}

// --- projections are scannable ---------------------------------------------

func TestTkdProjectionsNameOnlyColumnsTheSchemaHasWithADestination(t *testing.T) {
	schemas := tkdSchemas(t)
	for _, p := range tkdProjections {
		cols := tkdSelectColumns(tkdProjectionValue(t, p.file, p.constName))
		if len(cols) == 0 {
			t.Fatalf("%s.%s has no parsable columns", p.file, p.constName)
			continue
		}
		dests := tkdDbTagsOfStruct(t, p.module, p.structName)
		for _, col := range cols {
			if !schemas[p.table].columns[col] {
				t.Errorf("%s.%s selects %q from %s, which no migration creates", p.file, p.constName, col, p.table)
				continue
			}
			if !dests[col] {
				t.Errorf("%s.%s selects %q but %s.models.%s has no db destination for it; sqlx safe mode fails the whole read",
					p.file, p.constName, col, p.module, p.structName)
			}
		}

		// Reverse direction. The check above only proves the projection is safe;
		// it says nothing if a column is dropped from it, because omitting a
		// column is legal SQL and leaves the struct field permanently zero.
		// Compare the projection against the model's db tags instead, and let
		// omit carry the exceptions. Both directions are asserted so the omit
		// list cannot be used to mask a real omission: a name that appears in
		// both the projection and omit is stale.
		selected := map[string]bool{}
		for _, c := range cols {
			selected[c] = true
		}
		for _, o := range p.omit {
			if selected[o] {
				t.Errorf("%s.%s selects %q but also lists it in omit; drop it from omit", p.file, p.constName, o)
			}
		}
		omitSet := map[string]bool{}
		for _, o := range p.omit {
			omitSet[o] = true
		}
		missing := make([]string, 0)
		for c := range dests {
			if selected[c] || omitSet[c] {
				continue
			}
			missing = append(missing, c)
		}
		sort.Strings(missing)
		for _, c := range missing {
			t.Errorf("%s.%s never selects %q, so %s.models.%s.%s is always zero after a read; select it or name it in omit",
				p.file, p.constName, c, p.module, p.structName, c)
		}
	}
}

// --- 076's names are authoritative -----------------------------------------

var tkdBannedColumns = map[string]map[string]bool{
	"tickets":          {"type": true, "assigned_to": true},
	"ticket_relations": {"related_ticket_id": true, "relation_type": true},
	"ticket_transfers": {"from_engineer_id": true, "to_engineer_id": true},
}

func TestTkdNeitherModuleUsesThePre076ColumnAliases(t *testing.T) {
	seen := map[string]bool{}
	total := 0
	for _, module := range []string{tkdModuleA, tkdModuleB} {
		for _, src := range tkdModuleSources(t, module) {
			for _, ins := range tkdInserts([]tkdSrc{src}) {
				for _, col := range ins.cols {
					if tkdBannedColumns[ins.table][col] {
						t.Errorf("%s INSERT into %s uses %q; 076_create_ticketing_tables.sql has no such column", ins.path, ins.table, col)
					}
					seen[ins.table] = true
				}
			}
			total++
		}
	}
	if total == 0 {
		t.Fatal("no sources scanned; the check would be vacuous")
	}
	for _, tbl := range tkdTables {
		if !seen[tbl] {
			t.Fatalf("no INSERT against %s was examined; the check would be vacuous for it", tbl)
		}
	}
}

// --- module B: TicketRelation.ID must scan a UUID --------------------------

func TestTkdModuleBTicketRelationIDIsAString(t *testing.T) {
	b, err := os.ReadFile(filepath.Join("..", "..", tkdModuleB, "models/models.go"))
	if err != nil {
		t.Fatal(err)
	}
	body := string(b)
	start := strings.Index(body, "type TicketRelation struct {")
	if start < 0 {
		t.Fatal("models.TicketRelation not found")
	}
	end := strings.Index(body[start:], "\n}")
	if end < 0 {
		t.Fatal("models.TicketRelation block unterminated")
	}
	block := body[start : start+end]

	var line string
	for _, l := range strings.Split(block, "\n") {
		if strings.Contains(l, `db:"id"`) {
			line = l
			break
		}
	}
	if line == "" {
		t.Fatal("models.TicketRelation has no db:\"id\" field")
	}
	// 076 declares ticket_relations.id as UUID PRIMARY KEY, so a non-string
	// destination cannot hold the scanned value.
	if !regexp.MustCompile(`^\s*ID\s+string\s+`).MatchString(line) {
		t.Errorf("models.TicketRelation.ID is %q; ticket_relations.id is UUID, so the destination must be string", strings.TrimSpace(line))
	}
}

// --- module B: UpdateTicket must not be a no-op ----------------------------

// tkdIsNoopUpdate reports whether an UpdateTicket body throws away its updates
// map. Both markers are required: the fixed method checks a writable-column
// allow list and iterates the map to build the SET clause. If either is absent
// the map cannot reach SQL.
func tkdIsNoopUpdate(body string) bool {
	if !regexp.MustCompile(`range\s+updates`).MatchString(body) {
		return true
	}
	return !regexp.MustCompile(`writableTicketColumns`).MatchString(body)
}

// tkdFuncBodies parses src and returns each method's full text keyed
// "ReceiverType.MethodName". The body cannot be located by searching for the
// next "{" and counting braces: these signatures carry
// updates map[string]interface{}, so the first "{" after the signature is the
// empty pair in interface{}, the count closes on its "}" and the extraction
// returns only the signature. That silently happened to the previous version of
// this test, which then reported the fixed method as a no-op.
func tkdFuncBodies(src string) map[string]string {
	out := map[string]string{}
	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, "", src, 0)
	if err != nil {
		return out
	}
	for _, d := range f.Decls {
		fn, ok := d.(*ast.FuncDecl)
		if !ok {
			continue
		}
		var recv string
		if fn.Recv != nil && len(fn.Recv.List) > 0 {
			switch t := fn.Recv.List[0].Type.(type) {
			case *ast.StarExpr:
				if id, ok2 := t.X.(*ast.Ident); ok2 {
					recv = id.Name
				}
			case *ast.Ident:
				recv = t.Name
			}
		}
		if recv == "" {
			continue
		}
		s := fset.Position(fn.Pos()).Offset
		e := fset.Position(fn.End()).Offset
		out[recv+"."+fn.Name.Name] = src[s:e]
	}
	return out
}
func TestTkdModuleBUpdateTicketIsNotANoop(t *testing.T) {
	b, err := os.ReadFile(filepath.Join("..", "..", tkdModuleB, "repository/repository.go"))
	if err != nil {
		t.Fatal(err)
	}
	body, ok := tkdFuncBodies(string(b))["Repository.UpdateTicket"]
	if !ok || body == "" {
		t.Fatal("Repository.UpdateTicket not found")
	}
	if tkdIsNoopUpdate(body) {
		t.Errorf("Repository.UpdateTicket ignores its updates map: every transition, assignment, escalation, resolve and close would write only updated_at while reporting success")
	}

	// Positive control: the pre-fix body must trip the same detector, or the
	// assertion above proves nothing.
	preFix := `func (r *Repository) UpdateTicket(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		"UPDATE tickets SET updated_at = NOW() WHERE id=$1 AND tenant_id=$2", id, tenantID)
	return err
}`
	if !tkdIsNoopUpdate(preFix) {
		t.Fatal("the no-op detector accepted the pre-fix body; the check is vacuous")
	}
}

// TestTkdFuncBodiesExtractsPastAMapInTheSignature proves the extractor reaches
// the real body. The assertion above only means anything if "range updates" is
// actually inside what the extractor returns: truncated at interface{}'s "}"
// there would be neither marker and the test would fail loudly. This names the
// failure mode directly.
func TestTkdFuncBodiesExtractsPastAMapInTheSignature(t *testing.T) {
	src := "package p\n\n" +
		"func (r *R) Do(ctx context.Context, updates map[string]interface{}) error {\n" +
		"\tfor k := range updates {\n\t\t_ = k\n\t}\n\treturn nil\n}\n"
	body, ok := tkdFuncBodies(src)["R.Do"]
	if !ok {
		t.Fatal("R.Do not extracted")
	}
	if !strings.Contains(body, "return nil") {
		t.Fatalf("extraction stopped before the function body:\n%s", body)
	}
}

// TestTkdDeadModuleBFilesAreGone keeps deleted the three module-B repository
// files that wrote related_ticket_id, relation_type, from_engineer_id and
// to_engineer_id and read with SELECT *. They were unreachable - the liveness
// closure from every repository constructor to cmd/server found no caller, and
// the live route uses repository.Repository - but they were the precedent the
// live models had copied from.
func TestTkdDeadModuleBFilesAreGone(t *testing.T) {
	for _, name := range []string{"ticket.go", "relation.go", "transfer.go"} {
		if _, err := os.Stat(filepath.Join("..", "..", tkdModuleB, "repository", name)); err == nil {
			t.Errorf("%s/repository/%s is back: it writes columns 076 does not have and reads with SELECT *", tkdModuleB, name)
		}
	}
	// The live repository must still exist, so this cannot pass by deleting the
	// whole directory.
	if _, err := os.Stat(filepath.Join("..", "..", tkdModuleB, "repository", "repository.go")); err != nil {
		t.Fatalf("%s/repository/repository.go is missing", tkdModuleB)
	}
}
