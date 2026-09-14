package main

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// The lowcode-designer module is wired on every boot and twenty routes are
// registered under /lowcode-designer, and every one of its statements used
// MySQL-style ? placeholders against a Postgres driver, so nothing in the
// module could ever run. The five relations it owns are declared by
// 396_create_lowcode_designer.sql and by no other migration. The checks below
// derive the repository's column lists and INSERT column sets out of the Go
// source and compare them with what 396 declares, so the two halves cannot
// drift apart again.

var (
	reLCDTable = "(form_definition|form_field|form_template|form_instance|component_registry)"
	// reLCDCreate captures one table's own parenthesised block, so a sibling
	// table's identically named column cannot satisfy a check on this one.
	reLCDCreate = regexp.MustCompile(`(?s)CREATE TABLE(?:\s+IF NOT EXISTS)? ` + reLCDTable + `\s*\(([^;]+?)\);`)
	// reLCDAddColumn is the shape 572 and the like use to add a column later.
	reLCDAddColumn = regexp.MustCompile(`(?i)ALTER TABLE (` + reLCDTable + `) ADD COLUMN(?:\s+IF NOT EXISTS)? (\w+)`)
	// reLCDInsert is anchored on each INSERT's own column list. The bound
	// values are the Go arguments that follow the statement literal, so they
	// come out of lcdArgsAfterStatement rather than of the SQL.
	reLCDInsert = regexp.MustCompile(`(?s)INSERT INTO ` + reLCDTable + `\s*\(([^)]+)\)`)
	// The three column-list consts and the three update whitelists are read out
	// of the source rather than restated here.
	reLCDColumnsConst = regexp.MustCompile(`(formColumns|fieldColumns|templateColumns|instanceColumns|componentColumns)\s*=\s*` + "`([^`]+)`")
	reLCDUpdatable    = regexp.MustCompile(`(formUpdatable|fieldUpdatable|instanceUpdatable)\s*=\s*\[\]string\{([^}]*)\}`)
	// reLCDNotNullColumn takes the column name and its type apart, so it works
	// for every declared type rather than only the ones a shared pattern happens
	// to spell out.
	reLCDNotNullColumn = regexp.MustCompile(`(?i)^\s*(\w+)\s+([A-Za-z]+(?:\(\d+\))?)(.*)NOT NULL`)
	reLCDColumnDecl    = regexp.MustCompile(`(?i)^\s*(\w+)\s+([A-Za-z]+(?:\(\d+\))?)(.*)`)
	reLCDJSON          = regexp.MustCompile(`(?i)^\s*(JSON|JSONB)\s*$`)
)

func lowcodeSourceFiles(t *testing.T) []migrationFile {
	t.Helper()
	var out []migrationFile
	err := filepath.WalkDir("../../internal/lowcode-designer", func(path string, d os.DirEntry, err error) error {
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

// lcdDDL gathers, per table, its columns in declaration order, each column's
// declared type, and which of them are NOT NULL. A single pass over the same
// CREATE blocks, so the three views cannot disagree with each other.
//
// reLCDColumnDecl is deliberately looser than reLCDNotNullColumn: the JSON
// checks need the type of a nullable column too, and one that is only NOT
// NULL-recognising silently returns an empty type for those.
func lcdDDL(t *testing.T) (map[string][]string, map[string]map[string]string, map[string]map[string]bool) {
	ordered := map[string][]string{}
	types := map[string]map[string]string{}
	notNull := map[string]map[string]bool{}
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range reLCDCreate.FindAllStringSubmatch(f.body, -1) {
			table, block := m[1], m[2]
			if ordered[table] != nil {
				t.Errorf("%s is CREATEd more than once; the second is outside 396", table)
				continue
			}
			ordered[table] = []string{}
			types[table] = map[string]string{}
			notNull[table] = map[string]bool{}
			for _, line := range strings.Split(block, "\n") {
				c := reLCDColumnDecl.FindStringSubmatch(line)
				if c == nil || !lcdIsColumnLine(line) {
					continue
				}
				col, typ := c[1], strings.ToUpper(c[2])
				if _, dup := types[table][col]; dup {
					continue
				}
				ordered[table] = append(ordered[table], col)
				types[table][col] = typ
				if reLCDNotNullColumn.MatchString(line) {
					notNull[table][col] = true
				}
			}
		}
		for _, m := range reLCDAddColumn.FindAllStringSubmatch(f.body, -1) {
			if ordered[m[1]] == nil {
				continue
			}
			ordered[m[1]] = append(ordered[m[1]], m[2])
		}
	}
	return ordered, types, notNull
}

// splitDDLColumns is the shared helper used by the other migration tests; it
// drops constraint lines, which lcdDDL also must, so mirror that filter here
// with a prefix check on the trimmed line.
func lcdIsColumnLine(line string) bool {
	up := strings.ToUpper(strings.TrimSpace(line))
	for _, skip := range []string{"PRIMARY KEY", "UNIQUE", "CONSTRAINT", "CHECK", "CREATE INDEX", "FOREIGN KEY"} {
		if strings.HasPrefix(up, skip) {
			return false
		}
	}
	return true
}

// lcdArgsAfterStatement returns the Go arguments of the ExecContext call that
// carries the INSERT whose text starts at stmtStart. The bound expressions are
// the only thing a JSON-NULL check can inspect: the SQL itself only holds
// positional markers. Walking past the closing backtick to the argument list
// keeps the check honest rather than re-transcribing the columns by hand.
func lcdArgsAfterStatement(body string, stmtStart int) []string {
	// The INSERT text sits inside the literal, so the literal's opening backtick
	// is the last one before the match and the closing one is the first one
	// after it. Searching forward from the match would land on the closing
	// backtick first and then on the next statement's opening backtick.
	open := strings.LastIndex(body[:stmtStart], "`")
	if open < 0 {
		return nil
	}
	// close is an offset into body[open+1:], so the closing backtick itself sits
	// at open+1+close and the argument list starts one character past it.
	close := strings.Index(body[open+1:], "`")
	if close < 0 {
		return nil
	}
	i := open + 1 + close + 1
	for i < len(body) {
		if body[i] == ' ' || body[i] == '\t' || body[i] == '\n' || body[i] == ',' {
			i++
			continue
		}
		break
	}
	var args []string
	depth := 0
	buf := ""
	for i < len(body) {
		c := body[i]
		if c == '(' {
			depth++
		} else if c == ')' {
			if depth == 0 {
				break
			}
			depth--
		}
		if c == ',' && depth == 0 {
			args = append(args, strings.TrimSpace(buf))
			buf = ""
			i++
			continue
		}
		buf += string(c)
		i++
	}
	if strings.TrimSpace(buf) != "" {
		args = append(args, strings.TrimSpace(buf))
	}
	return args
}

func splitList(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

// Every relation the module's SQL mentions must be created by exactly one
// forward migration.
func TestMigrationsCreateEveryLowcodeDesignerRelation(t *testing.T) {
	creators := map[string][]string{}
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range reLCDCreate.FindAllStringSubmatch(f.body, -1) {
			creators[m[1]] = append(creators[m[1]], f.name)
		}
	}
	// The module has no local migrations directory of its own, so derive the
	// wanted set from the INSERT statements: every table it writes to must
	// exist, and it must be created by 396 and only 396.
	want := map[string]bool{}
	for _, src := range lowcodeSourceFiles(t) {
		for _, m := range reLCDInsert.FindAllStringSubmatch(src.body, -1) {
			want[m[1]] = true
		}
	}
	if len(want) != 5 {
		t.Fatalf("expected the five lowcode-designer relations, found %d: %v", len(want), sortedSetKeys(want))
	}
	for table, got := range creators {
		if len(got) != 1 || got[0] != "396_create_lowcode_designer.sql" {
			t.Errorf("%s is created by %v, want 396_create_lowcode_designer.sql only", table, got)
		}
	}
	for table := range want {
		if got := creators[table]; len(got) != 1 || got[0] != "396_create_lowcode_designer.sql" {
			t.Errorf("%s is created by %v, want 396_create_lowcode_designer.sql only", table, got)
		}
	}
}

// The five SELECT column lists must be the migration's own column sets, in
// order. Dropping a column would make the read return a zero field; adding one
// 396 does not declare would fail the statement outright.
func TestLowcodeDesignerColumnListsMatchMigration396(t *testing.T) {
	ordered, _, _ := lcdDDL(t)
	joined := strings.Join(bodiesOf(lowcodeSourceFiles(t)), "\n")

	wantTable := map[string]string{
		"formColumns":      "form_definition",
		"fieldColumns":     "form_field",
		"templateColumns":  "form_template",
		"instanceColumns":  "form_instance",
		"componentColumns": "component_registry",
	}
	matches := reLCDColumnsConst.FindAllStringSubmatch(joined, -1)
	if len(matches) != 5 {
		t.Fatalf("expected five column-list consts, found %d", len(matches))
	}
	seen := map[string]bool{}
	for _, m := range matches {
		name, body := m[1], m[2]
		seen[name] = true
		table, ok := wantTable[name]
		if !ok {
			t.Errorf("unexpected column list %q", name)
			continue
		}
		got := splitList(body)
		want := ordered[table]
		if len(got) != len(want) {
			t.Errorf("%s names %d columns for %s, 396 declares %d: %v", name, len(got), table, len(want), got)
			continue
		}
		for i := range want {
			if got[i] != want[i] {
				t.Errorf("%s position %d is %q, 396 declares %q for %s", name, i+1, got[i], want[i], table)
			}
		}
	}
	for name := range wantTable {
		if !seen[name] {
			t.Errorf("the %s column list was not found", name)
		}
	}
}

// Every INSERT must name the table's whole column set, and every NOT NULL
// column must be supplied by value. And a JSON column that 396 allows to be
// NULL has to be bound through jsonArg, because an empty string is not valid
// JSON and fails the insert before the row exists; a JSON column that 396
// declares NOT NULL must not be, because jsonArg turns an absent value into a
// SQL NULL that the NOT NULL constraint rejects.
func TestLowcodeDesignerInsertsFitTheMigratedSchema(t *testing.T) {
	ordered, types, notNull := lcdDDL(t)

	files := lowcodeSourceFiles(t)
	seen := map[string]bool{}
	n := 0
	for _, f := range files {
		idx := reLCDInsert.FindAllStringSubmatchIndex(f.body, -1)
		for _, m := range idx {
			n++
			// FindAllStringSubmatchIndex puts the whole match first, then one
			// pair per group, so the table name is m[2]:m[3] and the column list
			// is m[4]:m[5].
			table := f.body[m[2]:m[3]]
			seen[table] = true
			cols := splitList(f.body[m[4]:m[5]])
			vals := lcdArgsAfterStatement(f.body, m[0])
			want := ordered[table]
			if len(cols) != len(want) {
				t.Errorf("%s INSERT names %d columns, 396 declares %d: %v", table, len(cols), len(want), cols)
				continue
			}
			for i := range want {
				if cols[i] != want[i] {
					t.Errorf("%s INSERT position %d is %q, 396 declares %q", table, i+1, cols[i], want[i])
				}
			}
			if len(vals) != len(cols) {
				t.Errorf("%s INSERT binds %d values for %d columns", table, len(vals), len(cols))
				continue
			}
			// The positional comparison above already proves that the INSERT names
			// the whole declared set, so every NOT NULL column is supplied by value;
			// what the loop below adds is the JSON direction of that guarantee.
			for i, col := range cols {
				if reLCDJSON.MatchString(types[table][col]) {
					bound := vals[i]
					if notNull[table][col] {
						if strings.HasPrefix(bound, "jsonArg(") {
							t.Errorf("%s.%s is NOT NULL, so binding %q could send a SQL NULL", table, col, bound)
						}
					} else if !strings.HasPrefix(bound, "jsonArg(") {
						t.Errorf("%s.%s is nullable JSON but the INSERT binds %q, which sends an empty string", table, col, bound)
					}
				}
			}
		}
	}
	if n != 5 {
		t.Fatalf("expected five INSERT statements, found %d", n)
	}
	for table := range ordered {
		if !seen[table] {
			t.Errorf("no INSERT names %s", table)
		}
	}

	// The NOT NULL sets are pinned as well: the INSERT names every column, so a
	// relaxation in 396 would quietly make a zero-value write legal, and no
	// statement-level check would notice.
	wantNotNull := map[string][]string{
		"form_definition": {"id", "tenant_id", "name", "version", "status", "fields", "created_at", "updated_at"},
		"form_field": {"id", "tenant_id", "form_id", "key", "label", "type", "required", "visible",
			"disabled", "sortable_index", "created_at", "updated_at"},
		"form_template": {"id", "tenant_id", "name", "is_builtin", "form_schema", "usage_count",
			"created_at", "updated_at"},
		"form_instance": {"id", "tenant_id", "form_id", "data", "status", "created_at", "updated_at"},
		"component_registry": {"id", "tenant_id", "name", "display_name", "category",
			"props_schema", "is_builtin", "created_at"},
	}
	for table, want := range wantNotNull {
		got := map[string]bool{}
		for _, m := range reLCDCreate.FindAllStringSubmatch(migrationBody(t, "396_create_lowcode_designer.sql"), -1) {
			if m[1] == table {
				for _, line := range strings.Split(m[2], "\n") {
					for _, c := range reLCDNotNullColumn.FindAllStringSubmatch(line, -1) {
						got[c[1]] = true
					}
				}
			}
		}
		sort.Strings(want)
		if len(got) != len(want) {
			t.Errorf("%s has %d NOT NULL columns, want %d: %v", table, len(got), len(want), sortedSetKeys(got))
			continue
		}
		for _, c := range want {
			if !got[c] {
				t.Errorf("%s does not declare %s NOT NULL", table, c)
			}
		}
	}

	// A SELECT * on a real code line would make every read here fail the moment
	// a later migration adds a column the models do not declare. The check skips
	// comment lines: the module's own prose mentions SELECT * and that is not a
	// statement.
	for _, f := range files {
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

// The update whitelists are the injection boundary: a column that 396 does not
// declare would fail the UPDATE, and an identity column would let a caller
// re-point a row at another tenant or form.
func TestLowcodeDesignerUpdateWhitelistsNameOnlyRealColumns(t *testing.T) {
	ordered, _, _ := lcdDDL(t)
	joined := strings.Join(bodiesOf(lowcodeSourceFiles(t)), "\n")

	wantTable := map[string]string{
		"formUpdatable":     "form_definition",
		"fieldUpdatable":    "form_field",
		"instanceUpdatable": "form_instance",
	}
	never := map[string]bool{"id": true, "tenant_id": true, "created_at": true, "updated_at": true}
	matches := reLCDUpdatable.FindAllStringSubmatch(joined, -1)
	if len(matches) != 3 {
		t.Fatalf("expected three update whitelists, found %d", len(matches))
	}
	seen := map[string]bool{}
	for _, m := range matches {
		name, raw := m[1], m[2]
		seen[name] = true
		table, ok := wantTable[name]
		if !ok {
			t.Errorf("unexpected whitelist %q", name)
			continue
		}
		declared := map[string]bool{}
		for _, c := range ordered[table] {
			declared[c] = true
		}
		cols := splitList(raw)
		if len(cols) == 0 {
			t.Errorf("the %s whitelist is empty", name)
			continue
		}
		for _, c := range cols {
			c = strings.Trim(c, "\"' ")
			if !declared[c] {
				t.Errorf("%s allows %s, which 396 does not declare for %s", name, c, table)
			}
			if never[c] {
				t.Errorf("%s allows %s, which is identity or audit", name, c)
			}
		}
	}
	for name := range wantTable {
		if !seen[name] {
			t.Errorf("the %s whitelist was not found", name)
		}
	}

	// form_field.key is half of the unique index on (form_id, key) and is also
	// referenced by name from form_definition.fields, so the field whitelist must
	// not allow it: renaming the key would leave the form's embedded copy saying
	// something else.
	fieldRaw := ""
	for _, m := range reLCDUpdatable.FindAllStringSubmatch(joined, -1) {
		if m[1] == "fieldUpdatable" {
			fieldRaw = m[2]
		}
	}
	if fieldRaw != "" && strings.Contains(fieldRaw, `"key"`) {
		t.Error("fieldUpdatable allows key, which is the unique index and the form's embedded reference")
	}
}

// The statements must use Postgres placeholders. A ? placeholder against lib/pq
// is a syntax error at the driver level, so every method in the module failed
// before it could touch a row.
func TestLowcodeDesignerStatementsUsePostgresPlaceholders(t *testing.T) {
	for _, f := range lowcodeSourceFiles(t) {
		for i, line := range strings.Split(f.body, "\n") {
			trimmed := strings.TrimSpace(line)
			if trimmed == "" || strings.HasPrefix(trimmed, "//") {
				continue
			}
			if strings.Contains(trimmed, "?") {
				t.Errorf("%s line %d uses a MySQL-style placeholder: %s", f.name, i+1, trimmed)
			}
		}
	}
}

// 396 declares the JSON payloads as plain JSON, so a reader can only bind them
// as strings. The check pins that the modules that still use TEXT or JSONB for
// the same shape of payload have been widened or converted: it fails if a later
// migration changes the type of one of the five tables to JSONB, because
// lib/pq would then return []byte and the string fields would scan garbage.
func TestMigration396KeepsItsPayloadColumnsAsJSON(t *testing.T) {
	types := map[string]map[string]string{}
	_, types, _ = lcdDDL(t)
	want := map[string]string{
		"form_definition.tags":   "JSON",
		"form_definition.layout": "JSON",
		"form_definition.fields": "JSON",
		"form_definition.meta":   "JSON",
	}
	got := map[string]string{}
	for table, cols := range types {
		for col, typ := range cols {
			got[table+"."+col] = typ
		}
	}
	keys := make([]string, 0, len(want))
	for k := range want {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		if got[k] != want[k] {
			t.Errorf("%s is %s, want %s", k, got[k], want[k])
		}
	}
	if len(types) != 5 {
		t.Errorf("expected five tables, found %d: %v", len(types), sortedSetKeys(types))
	}
}
