package main

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// Round 59: the hyphenated-identifier class.
//
// Nineteen repository files named their relation with a hyphen at a
// table-reference position ("INSERT INTO ticket-automation",
// "SELECT * FROM message-queue"). An unquoted identifier containing a hyphen is
// a syntax error in postgres: the server rejects it during parsing, before name
// resolution, so the statement never reached the driver's relation lookup and no
// log line mentioned a missing table. Every route these modules register
// therefore failed on every request, in a mode no driver error could attribute
// to DDL.
//
// The relations were renamed to underscores and migrations 687 and 688 declare
// them. These tests pin all three sides: the code may not name a hyphenated
// relation again, each renamed relation has exactly one DDL owner, and the
// columns and db tags the repository and models declare still resolve against
// that DDL.

// hyphenFamily maps each renamed relation to the module whose repository owns
// it. The values are module directories, not identifiers.
var hyphenFamily = map[string]string{
	"message_queue":            "message-queue",
	"multi_modal_trigger":      "multi-modal-trigger",
	"notification_management":  "notification-management",
	"oci_registry":             "oci-registry",
	"plugin_hotreload":         "plugin-hotreload",
	"script_library":           "script-library",
	"script_version":           "script-version",
	"self_service":             "self-service",
	"ticket_knowledge":         "ticket-knowledge",
	"unified_config":           "unified-config",
	"vector_store":             "vector-store",
	"vectorize_rules":          "vectorize-rules",
	"version_archive":          "version-archive",
	"rate_limiting":            "rate-limiting",
	"test_reports":             "test-reports",
	"gateway_route_configs":    "gateway-routes",
	"service_catalog_requests": "service-catalog",
	"service_catalog_timeline": "service-catalog",
	"ticket_automation":        "ticket-automation",
}

// reHyphenSQL matches a hyphenated identifier in a table-reference position
// inside a SQL literal. The trailing continuation is required so that prose that
// happens to contain the same words is not read as a statement: the log message
// "failed to update job-action execution" must not report a relation. $ is the
// end of the literal, which covers statements built by concatenation where the
// WHERE clause is a separate literal.
var reHyphenSQL = regexp.MustCompile(`(?i)\b(?:FROM|INTO|UPDATE|TABLE|JOIN)\s+([a-z_][a-z0-9_]*-[a-z0-9_-]*)(?:[;,]|\s+(?:WHERE|SET|ORDER|GROUP|HAVING|LIMIT|OFFSET|VALUES|AS|ON|FOR)|\s*\(|$)`)

// reRelationSQL extracts a bare relation name from a SQL literal.
var reRelationSQL = regexp.MustCompile(`(?i)\b(?:FROM|INTO|UPDATE|TABLE|JOIN)\s+([a-z_][a-z0-9_]*)`)

// reSQLLiteral recognises a literal that starts with a SQL statement, so
// literals that merely contain the word SELECT or UPDATE are not read as SQL.
var reSQLLiteral = regexp.MustCompile(`(?is)^\s*(?:SELECT|INSERT|UPDATE|DELETE|WITH|VALUES|EXPLAIN|CREATE|ALTER|TRUNCATE)\b`)

// stringLit is one string literal with its byte offset inside the source, so a
// match can be reported as a line number.
type stringLit struct {
	val string
	off int
}

// stringLiterals returns every interpreted and raw string literal. Comments are
// excluded automatically because a comment is not a literal.
func stringLiterals(src string) []stringLit {
	var out []stringLit
	srcLit := []rune(src)
	for i := 0; i < len(srcLit); i++ {
		var lit string
		var start int
		switch srcLit[i] {
		case '`':
			start = i
			i++
			var b strings.Builder
			for i < len(srcLit) && srcLit[i] != '`' {
				b.WriteRune(srcLit[i])
				i++
			}
			lit = b.String()
		case '"':
			start = i
			i++
			var b strings.Builder
			for i < len(srcLit) && srcLit[i] != '"' {
				if srcLit[i] == '\\' {
					i++
					if i < len(srcLit) {
						b.WriteRune(srcLit[i])
					}
					continue
				}
				b.WriteRune(srcLit[i])
				i++
			}
			lit = b.String()
		default:
			continue
		}
		if strings.TrimSpace(lit) != "" {
			out = append(out, stringLit{val: lit, off: start})
		}
	}
	return out
}

// sqlLiterals returns the string literals that start a SQL statement.
func sqlLiterals(src string) []stringLit {
	var out []stringLit
	for _, l := range stringLiterals(src) {
		if reSQLLiteral.MatchString(l.val) {
			out = append(out, l)
		}
	}
	return out
}

// sqlHyphenHits returns the hyphenated relations the source names in SQL.
func sqlHyphenHits(src string) []string {
	out := []string{}
	for _, l := range sqlLiterals(src) {
		for _, m := range reHyphenSQL.FindAllStringSubmatch(l.val, -1) {
			if !containsStr(out, m[1]) {
				out = append(out, m[1])
			}
		}
	}
	sort.Strings(out)
	return out
}

// sqlRelations returns the distinct relations the source addresses in SQL.
func sqlRelations(src string) []string {
	out := []string{}
	for _, l := range sqlLiterals(src) {
		for _, m := range reRelationSQL.FindAllStringSubmatch(l.val, -1) {
			if !containsStr(out, m[1]) {
				out = append(out, m[1])
			}
		}
	}
	sort.Strings(out)
	return out
}

// internalGoFiles returns every non-test Go file under internal/. Repository
// SQL lives only there; test files are excluded so a regression test that quotes
// the old hyphenated name cannot fail its own detector. cmd/server holds no
// statement against a module relation.
func internalGoFiles() []string {
	var out []string
	err := filepath.Walk("../../internal", func(p string, info os.FileInfo, werr error) error {
		if werr != nil || info.IsDir() {
			return nil
		}
		if strings.HasSuffix(p, ".go") && !strings.HasSuffix(p, "_test.go") {
			out = append(out, p)
		}
		return nil
	})
	if err != nil {
		panic(err)
	}
	sort.Strings(out)
	return out
}

func hyphenModuleSource(mod string) string {
	var b strings.Builder
	err := filepath.Walk(filepath.Join("../../internal", mod), func(p string, info os.FileInfo, werr error) error {
		if werr != nil || info.IsDir() {
			return nil
		}
		if strings.HasSuffix(p, ".go") && !strings.HasSuffix(p, "_test.go") {
			if d, rerr := os.ReadFile(p); rerr == nil {
				b.WriteString(string(d))
				b.WriteByte('\n')
			}
		}
		return nil
	})
	if err != nil {
		return ""
	}
	return b.String()
}

// hyphenCreators returns every forward top-level migration whose CREATE TABLE
// names table.
func hyphenCreators(table string) []string {
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

// hyphenSchema accumulates a table's columns across every forward top-level
// migration, so an ADD COLUMN in a later migration still counts as declared.
func hyphenSchema(table string) map[string]bool {
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

// insertColumnLists returns every distinct column list the source INSERTs into
// table. The shared insertColumns helper finds only the first one, which misses
// modules with more than one insert statement.
func insertColumnLists(src, table string) [][]string {
	var out [][]string
	re := regexp.MustCompile(`(?is)INSERT\s+INTO\s+` + regexp.QuoteMeta(table) + `\s*\(([^)]*)\)`)
	for _, l := range sqlLiterals(src) {
		for _, m := range re.FindAllStringSubmatch(l.val, -1) {
			var cols []string
			for _, c := range strings.Split(m[1], ",") {
				if c = strings.TrimSpace(strings.ToLower(c)); c != "" {
					cols = append(cols, c)
				}
			}
			if len(cols) > 0 {
				out = append(out, cols)
			}
		}
	}
	return out
}

func TestMigration_HyphenDetectorIsNotVacuous(t *testing.T) {
	// One real statement with a hyphenated relation, one log message that uses
	// the same words, and one prose comment. The detector must return the
	// statement's relation and nothing else, or every assertion built on it
	// would pass or fail for the wrong reason.
	src := "func f() {\n" +
		"\ts := \"INSERT INTO ticket-automation (id, tenant_id) VALUES ($1, $2)\"\n" +
		"\tlogger.Error(\"failed to update job-action execution\", zap.Error(err))\n" +
		"\t// prose: INSERT INTO message-queue is hyphenated too\n" +
		"\ts2 := \"SELECT * FROM message_queue WHERE tenant_id = $1\"\n" +
		"\t_ = s\n\t_ = s2\n}\n"
	got := sqlHyphenHits(src)
	if len(got) != 1 || got[0] != "ticket-automation" {
		t.Fatalf("detector returned %v in a sample with one hyphenated statement, one log "+
			"message and one comment; it must return only the statement", got)
	}
	// The bare-relation extractor stops at a hyphen by construction, so it is not
	// the authority on the hyphenated class above; it must keep the underscore
	// relation and reject both non-SQL literals.
	rels := sqlRelations(src)
	if !containsStr(rels, "message_queue") {
		t.Errorf("relation extractor dropped the underscore relation: %v", rels)
	}
	for _, absent := range []string{"job-action", "message-queue"} {
		if containsStr(rels, absent) {
			t.Errorf("relation extractor read %q out of a non-SQL literal", absent)
		}
	}
}

func TestMigration_NoRepositoryNamesAHyphenatedRelation(t *testing.T) {
	files := internalGoFiles()
	if len(files) < 150 {
		t.Fatalf("only %d non-test Go files scanned under internal/; the walk is wrong", len(files))
	}
	scanned := 0
	for _, f := range files {
		b, err := os.ReadFile(f)
		if err != nil {
			continue
		}
		src := string(b)
		for _, rel := range sqlHyphenHits(src) {
			// Locate the literal that names this relation, for the report.
			for _, l := range sqlLiterals(src) {
				if !strings.Contains(l.val, rel) {
					continue
				}
				scanned++
				line := 1 + strings.Count(src[:l.off], "\n")
				t.Errorf("hyphenated relation in a table-reference position: %s:%d %q\n"+
					"an unquoted identifier with a hyphen is a postgres syntax error, so the "+
					"statement fails during parsing and never reaches the driver's relation lookup",
					f, line, rel)
			}
		}
	}
	t.Logf("scanned %d files, %d hyphenated relation occurrence(s)", len(files), scanned)
}

func TestMigration_HyphenFamily_EveryRelationHasExactlyOneOwner(t *testing.T) {
	tables := sortedMapKeys(hyphenFamily)
	if len(tables) != 19 {
		t.Fatalf("hyphenFamily lists %d relations, expected 19; the family is out of sync with 687 and 688",
			len(tables))
	}
	for _, table := range tables {
		owners := hyphenCreators(table)
		t.Logf("%-26s %-22s %d owner(s): %v", table, hyphenFamily[table], len(owners), owners)
		if len(owners) != 1 {
			t.Errorf("%s has %d forward owner(s) %v; exactly one migration must create it",
				table, len(owners), owners)
		}
	}
}

// service_catalog_requests is the one relation in the family with no writer:
// the repository SELECTs and UPDATEs it but nothing INSERTs into it. Every other
// relation must have at least one insert whose column list resolves against the
// DDL. sqlx fails the whole statement on a single missing column.
func TestMigration_HyphenFamily_InsertColumnsExistInTheDDL(t *testing.T) {
	checked := 0
	for _, table := range sortedMapKeys(hyphenFamily) {
		mod := hyphenFamily[table]
		lists := insertColumnLists(hyphenModuleSource(mod), table)
		if len(lists) == 0 {
			if table != "service_catalog_requests" {
				t.Errorf("no INSERT INTO %s found in %s; the detector is reading the wrong module",
					table, mod)
			} else {
				t.Logf("%s has no INSERT (recorded gap); column check skipped", table)
			}
			continue
		}
		checked++
		seen := map[string]bool{}
		for _, cols := range lists {
			for _, c := range cols {
				seen[c] = true
			}
		}
		got := sortedMapKeys(seen)
		t.Logf("%-26s INSERT INTO %-26s %d column(s): %v", mod, table, len(got), got)
		for _, c := range columnsNotDeclared(hyphenSchema(table), got) {
			t.Errorf("%s writes %s.%s, which no migration declares", mod, table, c)
		}
	}
	if checked < 18 {
		t.Errorf("only %d of 19 relations had an insert checked; the insert detector is under-matching",
			checked)
	}
}

// Every relation in the family is written by an INSERT with an explicit column
// list and read back with SELECT *. The model that binds it therefore needs two
// things: a db tag for every column the repository writes, and each tag must
// resolve to a column a migration declares.
//
// The write side is the load-bearing half. sqlx matches a struct field to a
// column by its db tag, falling back to the lowercased field name (CreatedAt ->
// createdat), so a written column with no tag is stored and then silently
// dropped on every SELECT * -- no error, no log line, just a column the API
// accepts and never returns. The hyphen rename alone left rate-limiting,
// test-reports and gateway-routes without any tags at all, so every one of
// their rows came back half-empty.
//
// service_catalog_timeline is the one relation exempt from the write side: its
// writer and its reader are the same struct, which also reads
// service_catalog_requests, and the two tables have different shapes. That
// mismatch is the deferred service-catalog requests cluster, pinned here rather
// than papered over.
func TestMigration_HyphenFamily_ModelTagsResolveAgainstTheDDL(t *testing.T) {
	taggedModules := 0
	coveredRelations := 0
	for _, mod := range sortedMapKeys(modsInFamily()) {
		src := hyphenModuleSource(mod)
		// A model may name a column of any relation the module addresses, so the
		// comparison set is the union over the module's relations, not just the
		// renamed ones: service-catalog also owns service_catalogs from migration
		// 181, whose model would otherwise be reported as undeclared.
		relations := sqlRelations(src)
		if len(relations) == 0 {
			t.Fatalf("no relation found in %s, so the detector is reading the wrong module", mod)
		}
		union := map[string]bool{}
		for _, rel := range relations {
			for c := range hyphenSchema(rel) {
				union[c] = true
			}
		}
		if len(union) == 0 {
			t.Fatalf("%s addresses %v but no migration declares any column of them", mod, relations)
		}
		t.Logf("%-22s addresses %v; %d declared column(s) across them", mod, relations, len(union))

		tags := []string{}
		tagsByStruct := 0
		for _, m := range reStructBlock.FindAllStringSubmatch(src, -1) {
			st := []string{}
			for _, tag := range reDbTag.FindAllStringSubmatch(m[2], -1) {
				st = append(st, tag[1])
			}
			if len(st) == 0 {
				continue
			}
			tagsByStruct++
			taggedModules++
			tags = append(tags, st...)
			for _, c := range columnsNotDeclared(union, st) {
				t.Errorf("%s %s declares db:%q, which no migration creates for this module",
					mod, m[1], c)
			}
		}
		if tagsByStruct == 0 {
			t.Errorf("%s has no db-tagged model, so a SELECT * cannot bind any row", mod)
			continue
		}

		tagged := map[string]bool{}
		for _, c := range tags {
			tagged[c] = true
		}
		for _, rel := range relations {
			if rel == "service_catalog_timeline" {
				t.Logf("%s: %s is written by a struct that also reads a differently shaped "+
					"table; write-side coverage is the recorded service-catalog gap", mod, rel)
				continue
			}
			lists := insertColumnLists(src, rel)
			if len(lists) == 0 {
				continue // no writer; the insert test records that gap
			}
			coveredRelations++
			written := map[string]bool{}
			for _, cols := range lists {
				for _, c := range cols {
					written[c] = true
				}
			}
			for _, c := range sortedMapKeys(written) {
				if !tagged[c] {
					t.Errorf("%s writes %s.%s but no model field is tagged for it, so the value is "+
						"stored and silently dropped on every SELECT *", mod, rel, c)
				}
			}
		}
	}
	if taggedModules < 18 {
		t.Errorf("only %d tagged models found across the family; the detector is under-matching",
			taggedModules)
	}
	if coveredRelations < 17 {
		t.Errorf("only %d relations had write-side coverage checked; the detector is under-matching",
			coveredRelations)
	}
}

// modsInFamily returns the distinct module directories in hyphenFamily.
func modsInFamily() map[string]bool {
	out := map[string]bool{}
	for _, mod := range hyphenFamily {
		out[mod] = true
	}
	return out
}

// sortedMapKeys sorts the keys of a string-keyed map of any value type. The
// shared sortedKeys helper in this package is typed to map[string][]string.
func sortedMapKeys[V any](m map[string]V) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// CREATE INDEX ON <table>(...) names a relation, so a typo there would create
// an index on a table that does not exist and drop the migration.
func TestMigration_HyphenFamily_IndexesNameDeclaredTables(t *testing.T) {
	upBody := migrationBody(t, "688_create_hyphen_named_module_tables.sql")
	re := regexp.MustCompile(`(?is)CREATE INDEX IF NOT EXISTS\s+[a-z_][a-z0-9_]*\s+ON\s+([a-z_][a-z0-9_]*)`)
	count := 0
	for _, m := range re.FindAllStringSubmatch(upBody, -1) {
		count++
		if len(hyphenCreators(m[1])) == 0 {
			t.Errorf("688 indexes %s, which no forward migration creates", m[1])
		}
	}
	if count != 36 {
		t.Errorf("688 declares %d CREATE INDEX statements, expected 36", count)
	}
}

// 687 and 688 must each be a unique version in the applied set: LoadMigrations
// parses the numeric prefix and treats a duplicate as the same migration.
func TestMigration_HyphenFamily_VersionNumbersAreUnique(t *testing.T) {
	for _, version := range []string{"687", "688"} {
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
		t.Logf("version %s: %d forward(s) %v, %d down(s) %v", version, len(forwards), forwards,
			len(downs), downs)
		if len(forwards) != 1 {
			t.Errorf("version %s has %d forward migration(s): %v", version, len(forwards), forwards)
		}
		if len(downs) != 1 {
			t.Errorf("version %s has %d down migration(s): %v", version, len(downs), downs)
		}
	}
}
