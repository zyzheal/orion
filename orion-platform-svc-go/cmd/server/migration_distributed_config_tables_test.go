package main

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// The distributed-config module is wired on every boot and twenty-one routes
// are registered under /config, and it owns eight relations that no other
// module reads: config_namespace, config_group, config_item,
// config_item_history, config_snapshot, config_release,
// config_release_history and config_audit. 395 declares all eight and 406 adds
// the three Phase 302 columns to config_item, so the two migrations together
// are the whole contract the repository reads against.
//
// The checks below derive the repository's eight column lists and its eight
// INSERT column sets out of the Go source and compare them with what 395 and
// 406 declare, so the two halves cannot drift apart again.

var (
	// The alternation is deliberately exact: config_snapshots and config_audit_entries
	// exist in 024 with plural or suffixed names, and a prefix match would pull a
	// foreign table's block into the checks. What follows the group is a space or
	// a parenthesised column list, so a longer name cannot satisfy it.
	reDCTable = "(config_namespace|config_group|config_item_history|config_item|config_release_history|config_release|config_snapshot|config_audit)"
	// reDCCreate captures one table's own parenthesised block, so a sibling
	// table's identically named column cannot satisfy a check on this one.
	reDCCreate = regexp.MustCompile(`(?s)CREATE TABLE(?:\s+IF NOT EXISTS)? ` + reDCTable + `\s*\(([^;]+?)\);`)
	// reDCAddColumns is the shape 406 uses to add the Level columns, where the
	// ADD COLUMN clauses start on the line after the ALTER TABLE line and the
	// statement carries three of them. Capturing the whole statement is what
	// makes all three visible: anchoring on the ALTER TABLE line only ever saw
	// the first. The whitespace after the table name is load-bearing: without it
	// config_snapshots and config_audit_entries would match as config_snapshot
	// and config_audit and report additions that never happened.
	// reDCAddColumns must not add its own pair of parentheses around reDCTable:
	// that alternation already captures, so wrapping it pushes the statement body
	// from group two to group three and the fold silently sees no ADD COLUMN.
	reDCAddColumns    = regexp.MustCompile(`(?is)ALTER TABLE ` + reDCTable + `\s([^;]*);`)
	reDCAddColumnPos  = regexp.MustCompile(`(?i)ADD\s+COLUMN`)
	reDCAddColumnDecl = regexp.MustCompile(`(?i)^\s*(\w+)\s+([A-Za-z]+(?:\(\d+\))?)(.*)`)
	// reDCInsert is anchored on each INSERT's own column list. The bound values
	// are the Go arguments that follow the statement literal, so they come out
	// of the shared args-after-statement walker rather than of the SQL.
	reDCInsert = regexp.MustCompile(`(?s)INSERT INTO ` + reDCTable + `\s*\(([^)]+)\)`)
	// The eight column-list consts and the two update whitelists are read out of
	// the source rather than restated here.
	reDCColumnsConst = regexp.MustCompile(`(namespaceColumns|groupColumns|itemColumns|itemHistoryColumns|snapshotColumns|releaseColumns|releaseHistoryColumns|auditColumns)\s*=\s*` + "`([^`]+)`")
	reDCUpdatable    = regexp.MustCompile(`(itemUpdatable|releaseUpdatable)\s*=\s*\[\]string\{([^}]*)\}`)
	// reDCNotNullColumn takes the column name and its type apart, so it works for
	// every declared type: 406 declares priority as INT NOT NULL, and the shared
	// reNotNullColumn used by the runbook checks does not spell INT out.
	reDCNotNullColumn = regexp.MustCompile(`(?i)^\s*(\w+)\s+([A-Za-z]+(?:\(\d+\))?)(.*)NOT NULL`)
	reDCColumnDecl    = regexp.MustCompile(`(?i)^\s*(\w+)\s+([A-Za-z]+(?:\(\d+\))?)(.*)`)
	// The keyword has to be followed by a space, a paren or the end of line, so a
	// column named checksum is not mistaken for a CHECK constraint.
	reDCConstraint = regexp.MustCompile(`(?i)^(PRIMARY\s+KEY|UNIQUE|CONSTRAINT|CHECK|FOREIGN\s+KEY|CREATE\s+INDEX|INDEX|KEY)(\s|\(|$)`)
	reDCJSON       = regexp.MustCompile(`(?i)^\s*(JSON|JSONB)\s*$`)
	// reDCField pairs a struct field's Go type with its db tag, which is what a
	// NULL-scan check needs: the column can be nullable only if the field can
	// receive NULL.
	reDCField = regexp.MustCompile("^\\s*(\\w+)\\s+([A-Za-z.]+)\\s+\u0060db:\"([a-z_]+)\"")
)

func dcSourceFiles(t *testing.T) []migrationFile {
	t.Helper()
	var out []migrationFile
	err := filepath.WalkDir("../../internal/distributed-config", func(path string, d os.DirEntry, err error) error {
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

// dcDDL gathers, per table, its columns in declaration order, each column's
// declared type, and which of them are NOT NULL. A single pass over the same
// CREATE blocks, so the three views cannot disagree with each other. 406's three
// ADD COLUMNs are folded into config_item's order, which is how the schema the
// repository reads actually looks.
//
// reDCColumnDecl is deliberately looser than reDCNotNullColumn: the JSON checks
// need the type of a nullable column too, and one that is only NOT NULL
// -recognising silently returns an empty type for those.
func dcDDL(t *testing.T) (map[string][]string, map[string]map[string]string, map[string]map[string]bool) {
	ordered := map[string][]string{}
	types := map[string]map[string]string{}
	notNull := map[string]map[string]bool{}
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range reDCCreate.FindAllStringSubmatch(f.body, -1) {
			table, block := m[1], m[2]
			if ordered[table] != nil {
				t.Errorf("%s is CREATEd more than once; the second is outside 395", table)
				continue
			}
			ordered[table] = []string{}
			types[table] = map[string]string{}
			notNull[table] = map[string]bool{}
			for _, line := range strings.Split(block, "\n") {
				c := reDCColumnDecl.FindStringSubmatch(line)
				if c == nil || !dcIsColumnLine(line) {
					continue
				}
				col, typ := c[1], strings.ToUpper(c[2])
				if _, dup := types[table][col]; dup {
					continue
				}
				ordered[table] = append(ordered[table], col)
				types[table][col] = typ
				if reDCNotNullColumn.MatchString(line) {
					notNull[table][col] = true
				}
			}
		}
	}
	// The additions are a second pass: entriesInMigrationsDir does not sort, so
	// 406 can be walked before 395 and an ADD would find no CREATE to attach to.
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range reDCAddColumns.FindAllStringSubmatch(f.body, -1) {
			table := m[1]
			if ordered[table] == nil {
				continue
			}
			// One ALTER TABLE can carry several ADD COLUMN clauses, so each clause
			// is cut at the next ADD COLUMN and parsed for its own type and its own
			// NOT NULL: folding only the name would leave a new NOT NULL column
			// invisible to the insert check.
			pos := reDCAddColumnPos.FindAllStringIndex(m[2], -1)
			for k, iv := range pos {
				clauseEnd := len(m[2])
				if k+1 < len(pos) {
					clauseEnd = pos[k+1][0]
				}
				d := reDCAddColumnDecl.FindStringSubmatch(m[2][iv[1]:clauseEnd])
				if d == nil {
					continue
				}
				col := d[1]
				if _, dup := types[table][col]; dup {
					continue
				}
				ordered[table] = append(ordered[table], col)
				types[table][col] = strings.ToUpper(d[2])
				if strings.Contains(strings.ToUpper(d[3]), "NOT NULL") {
					notNull[table][col] = true
				}
			}
		}
	}
	return ordered, types, notNull
}

// dcIsColumnLine reports whether a line inside a CREATE TABLE block is a column
// declaration. The other migration tests filter with a prefix test, but that
// swallows a column named checksum because it starts with the CHECK keyword, so
// the keyword needs a word boundary here.
func dcIsColumnLine(line string) bool {
	up := strings.ToUpper(strings.TrimSpace(line))
	return !reDCConstraint.MatchString(up)
}

// dcModelFields maps each DB-tagged struct to its db tag and its Go type, read
// out of models.go. The JSON checks need this rather than the column list,
// because a column's nullability is only safe if the field that scans it can
// receive NULL.
func dcModelFields(t *testing.T) map[string]map[string]string {
	t.Helper()
	out := map[string]map[string]string{}
	for _, f := range dcSourceFiles(t) {
		if !strings.HasSuffix(f.name, "/models.go") {
			continue
		}
		lines := strings.Split(f.body, "\n")
		for i := 0; i < len(lines); i++ {
			head := regexp.MustCompile(`type\s+(\w+)\s+struct\s*\{`).FindStringSubmatch(lines[i])
			if head == nil {
				continue
			}
			name := head[1]
			fld := map[string]string{}
			for j := i + 1; j < len(lines); j++ {
				if strings.TrimSpace(lines[j]) == "}" {
					break
				}
				m := reDCField.FindStringSubmatch(lines[j])
				if m == nil {
					continue
				}
				if _, dup := fld[m[3]]; dup {
					continue
				}
				fld[m[3]] = m[2]
			}
			out[name] = fld
		}
	}
	return out
}

// Every relation the module's SQL names must be created by exactly one forward
// migration, and 406 must be the only migration that adds columns to any of the
// eight: any other ALTER would leave the repository's column lists behind.
func TestMigrationsCreateEveryDistributedConfigRelation(t *testing.T) {
	creators := map[string][]string{}
	adders := map[string][]string{}
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range reDCCreate.FindAllStringSubmatch(f.body, -1) {
			creators[m[1]] = append(creators[m[1]], f.name)
		}
		for _, m := range reDCAddColumns.FindAllStringSubmatch(f.body, -1) {
			adders[m[1]] = append(adders[m[1]], f.name)
		}
	}

	// The wanted set is derived from the INSERT statements: every table the
	// module writes to must exist, and it must be created by 395 and only 395.
	want := map[string]bool{}
	for _, src := range dcSourceFiles(t) {
		for _, m := range reDCInsert.FindAllStringSubmatch(src.body, -1) {
			want[m[1]] = true
		}
	}
	if len(want) != 8 {
		t.Fatalf("expected the eight distributed-config relations, found %d: %v", len(want), sortedSetKeys(want))
	}
	for table, got := range creators {
		if len(got) != 1 || got[0] != "395_create_distributed_config.sql" {
			t.Errorf("%s is created by %v, want 395_create_distributed_config.sql only", table, got)
		}
	}
	for table := range want {
		if got := creators[table]; len(got) != 1 || got[0] != "395_create_distributed_config.sql" {
			t.Errorf("%s is created by %v, want 395_create_distributed_config.sql only", table, got)
		}
	}
	if len(adders) != 1 || len(adders["config_item"]) != 1 || adders["config_item"][0] != "406_add_config_item_level_fields.sql" {
		t.Errorf("column additions outside 406 would desync the column lists: %v", sortedSetKeys(adders))
	}
	if len(adders["config_item"]) != 1 {
		t.Fatalf("406 must add to config_item, found %v", adders["config_item"])
	}
}

// The eight SELECT column lists must be the migrations' own column sets, in
// order. Dropping a column would make the read return a zero field; adding one
// 395 and 406 do not declare would fail the statement outright.
func TestDistributedConfigColumnListsMatchMigration395(t *testing.T) {
	ordered, _, _ := dcDDL(t)
	joined := strings.Join(bodiesOf(dcSourceFiles(t)), "\n")

	wantTable := map[string]string{
		"namespaceColumns":      "config_namespace",
		"groupColumns":          "config_group",
		"itemColumns":           "config_item",
		"itemHistoryColumns":    "config_item_history",
		"snapshotColumns":       "config_snapshot",
		"releaseColumns":        "config_release",
		"releaseHistoryColumns": "config_release_history",
		"auditColumns":          "config_audit",
	}
	matches := reDCColumnsConst.FindAllStringSubmatch(joined, -1)
	if len(matches) != 8 {
		t.Fatalf("expected eight column-list consts, found %d", len(matches))
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
			t.Errorf("%s names %d columns for %s, the migrations declare %d: %v", name, len(got), table, len(want), got)
			continue
		}
		for i := range want {
			if got[i] != want[i] {
				t.Errorf("%s position %d is %q, the migrations declare %q for %s", name, i+1, got[i], want[i], table)
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
// column must be supplied by value. The NOT NULL sets are pinned too: the
// INSERT names every column, so a relaxation in 395 or 406 would quietly make a
// zero-value write legal and no statement-level check would notice.
func TestDistributedConfigInsertsFitTheMigratedSchema(t *testing.T) {
	ordered, _, notNull := dcDDL(t)

	// The INSERTs interpolate their column-list const rather than spelling the
	// columns out, so the expression has to be resolved through the consts that
	// dcSourceFiles read from the same file.
	consts := map[string][]string{}
	for _, m := range reDCColumnsConst.FindAllStringSubmatch(strings.Join(bodiesOf(dcSourceFiles(t)), "\n"), -1) {
		consts[m[1]] = splitList(m[2])
	}
	files := dcSourceFiles(t)
	seen := map[string]bool{}
	n := 0
	for _, f := range files {
		idx := reDCInsert.FindAllStringSubmatchIndex(f.body, -1)
		for _, m := range idx {
			n++
			// FindAllStringSubmatchIndex puts the whole match first, then one pair
			// per group, so the table name is m[2]:m[3] and the column list is
			// m[4]:m[5].
			table := f.body[m[2]:m[3]]
			seen[table] = true
			cols := resolveDCColumns(strings.TrimSpace(f.body[m[4]:m[5]]), consts)
			vals := dcArgsAfterStatement(f.body, m[0])
			want := ordered[table]
			if len(cols) != len(want) {
				t.Errorf("%s INSERT names %d columns, the migrations declare %d: %v", table, len(cols), len(want), cols)
				continue
			}
			for i := range want {
				if cols[i] != want[i] {
					t.Errorf("%s INSERT position %d is %q, the migrations declare %q", table, i+1, cols[i], want[i])
				}
			}
			if len(vals) != len(cols) {
				t.Errorf("%s INSERT binds %d values for %d columns", table, len(vals), len(cols))
				continue
			}
		}
	}
	if n != 8 {
		t.Fatalf("expected eight INSERT statements, found %d", n)
	}
	for table := range ordered {
		if !seen[table] {
			t.Errorf("no INSERT names %s", table)
		}
	}

	wantNotNull := map[string][]string{
		"config_namespace": {"id", "tenant_id", "name", "status", "created_at", "updated_at"},
		"config_group":     {"id", "tenant_id", "namespace_id", "name", "created_at", "updated_at"},
		"config_item": {"id", "tenant_id", "group_id", "namespace_id", "key_name", "value", "value_type",
			"encrypted", "created_at", "updated_at", "level", "priority"},
		"config_item_history": {"id", "tenant_id", "item_id", "version", "new_value", "operator", "created_at"},
		"config_snapshot": {"id", "tenant_id", "group_id", "namespace_id", "environment", "version", "data",
			"checksum", "created_at", "created_by"},
		"config_release": {"id", "tenant_id", "snapshot_id", "group_id", "environment", "release_version",
			"status", "created_at"},
		"config_release_history": {"id", "tenant_id", "release_id", "group_id", "environment", "version", "action",
			"created_at"},
		"config_audit": {"id", "tenant_id", "actor", "action", "target_type", "target_id", "created_at"},
	}
	for table, want := range wantNotNull {
		if _, ok := notNull[table]; !ok {
			t.Errorf("%s is not in the DDL view at all", table)
			continue
		}
		sort.Strings(want)
		if len(notNull[table]) != len(want) {
			t.Errorf("%s has %d NOT NULL columns, want %d: %v", table, len(notNull[table]), len(want), sortedSetKeys(notNull[table]))
			continue
		}
		for _, c := range want {
			if !notNull[table][c] {
				t.Errorf("%s does not declare %s NOT NULL", table, c)
			}
		}
	}

	// A SELECT * on a real code line would make every read here fail the moment a
	// later migration adds a column the models do not declare. The check skips
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

// The update whitelists are the injection boundary: a column that the migrations
// do not declare would fail the UPDATE, and an identity column would let a
// caller re-point a row at another tenant or namespace.
func TestDistributedConfigUpdateWhitelistsNameOnlyRealColumns(t *testing.T) {
	ordered, _, _ := dcDDL(t)
	joined := strings.Join(bodiesOf(dcSourceFiles(t)), "\n")

	wantTable := map[string]string{
		"itemUpdatable":    "config_item",
		"releaseUpdatable": "config_release",
	}
	never := map[string]bool{"id": true, "tenant_id": true, "created_at": true, "updated_at": true}
	matches := reDCUpdatable.FindAllStringSubmatch(joined, -1)
	if len(matches) != 2 {
		t.Fatalf("expected two update whitelists, found %d", len(matches))
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
				t.Errorf("%s allows %s, which the migrations do not declare for %s", name, c, table)
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

	// group_id, key_name and namespace_id sit under idx_group_key_config_item, so
	// the item whitelist must not allow them: renaming the key would break the
	// unique index, and re-pointing the group or namespace moves a row into
	// someone else's scope.
	itemRaw := ""
	for _, m := range reDCUpdatable.FindAllStringSubmatch(joined, -1) {
		if m[1] == "itemUpdatable" {
			itemRaw = m[2]
		}
	}
	if itemRaw != "" {
		for _, c := range []string{"group_id", "key_name", "namespace_id"} {
			if strings.Contains(itemRaw, `"`+c+`"`) {
				t.Errorf("itemUpdatable allows %s, which is part of the unique index", c)
			}
		}
	}
}

// The statements must use Postgres placeholders. A ? placeholder against lib/pq
// is a syntax error at the driver level, so every method in the module would fail
// before it could touch a row.
func TestDistributedConfigStatementsUsePostgresPlaceholders(t *testing.T) {
	for _, f := range dcSourceFiles(t) {
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

// The three JSON columns split into two nullabilities, and each needs a different
// Go field. A NOT NULL JSON column must scan into a plain string, because the
// module's nil-swallowing Text type would turn an absent value into an empty
// string that the constraint refuses. A nullable one must scan into Text, because
// a plain string cannot receive NULL at all and one NULL fails the whole read.
func TestDistributedConfigJSONColumnsMatchTheirModelFields(t *testing.T) {
	_, types, notNull := dcDDL(t)
	fields := dcModelFields(t)

	wantStruct := map[string]string{
		"config_namespace":       "ConfigNamespace",
		"config_group":           "ConfigGroup",
		"config_item":            "ConfigItem",
		"config_item_history":    "ConfigItemHistory",
		"config_snapshot":        "ConfigSnapshot",
		"config_release":         "ConfigRelease",
		"config_release_history": "ConfigReleaseHistory",
		"config_audit":           "ConfigAudit",
	}

	jsonCols := map[string]bool{}
	for table, cols := range types {
		for col, typ := range cols {
			if reDCJSON.MatchString(typ) {
				jsonCols[table+"."+col] = true
			}
		}
	}
	// Pinned, not just derived: the three JSON columns are the only ones, and their
	// nullability is what the field types must follow.
	wantJSON := map[string]bool{
		"config_audit.detail":  false,
		"config_item.labels":   false,
		"config_snapshot.data": true,
	}
	if len(jsonCols) != len(wantJSON) {
		t.Errorf("found %d JSON columns, want %d: %v", len(jsonCols), len(wantJSON), sortedSetKeys(jsonCols))
	}
	keys := make([]string, 0, len(wantJSON))
	for k := range wantJSON {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		table, col := splitOne(k, ".")
		if !jsonCols[k] {
			t.Errorf("%s is no longer a JSON column", k)
			continue
		}
		if notNull[table][col] != wantJSON[k] {
			t.Errorf("%s is NOT NULL = %v, want %v", k, notNull[table][col], wantJSON[k])
		}
		fld, ok := fields[wantStruct[table]]
		if !ok {
			t.Errorf("the model struct %s was not found", wantStruct[table])
			continue
		}
		got, has := fld[col]
		if !has {
			t.Errorf("%s has no model field with db tag %q", wantStruct[table], col)
			continue
		}
		if wantJSON[k] && got == "Text" {
			t.Errorf("%s is NOT NULL but %s.%s is Text, which would bind an empty string", k, wantStruct[table], col)
		}
		if !wantJSON[k] && got != "Text" {
			t.Errorf("%s is nullable but %s.%s is %s, which cannot scan a NULL", k, wantStruct[table], col, got)
		}
	}
}

// resolveDCColumns turns an INSERT column expression into a column list. The
// repository interpolates a const identifier, so an unresolved identifier would
// silently compare a one-element list against the schema and only surface as a
// length mismatch.
var reDCIdent = regexp.MustCompile(`[a-zA-Z][a-zA-Z0-9_]*`)

func resolveDCColumns(expr string, consts map[string][]string) []string {
	if cols := consts[expr]; len(cols) > 0 {
		return cols
	}
	// The capture crosses a string-literal boundary, so it keeps the quotes that
	// surround the identifier: INSERT INTO t ("+itemColumns+") VALUES.
	if id := reDCIdent.FindString(expr); id != "" {
		if cols := consts[id]; len(cols) > 0 {
			return cols
		}
	}
	return splitList(expr)
}

func splitOne(s, sep string) (string, string) {
	i := strings.Index(s, sep)
	if i < 0 {
		return s, ""
	}
	return s[:i], s[i+len(sep):]
}

// dcArgsAfterStatement returns the Go arguments of the ExecContext call that
// carries the INSERT whose text starts at stmtStart. The bound expressions are
// the only thing an arity check can inspect, so walking the SQL literal through
// to the argument list keeps the check honest rather than re-transcribing the
// columns by hand.
func dcArgsAfterStatement(body string, stmtStart int) []string {
	open := strings.LastIndex(body[:stmtStart], "\"")
	if open < 0 {
		return nil
	}
	// The repository writes its SQL in double-quoted literals and interpolates
	// the column list across a literal boundary, so a backtick walk never finds
	// the argument list at all: LastIndex lands on an unrelated backtick and the
	// rest of the walk runs over code. depth starts at one because the argument
	// code depth starts at zero: the SQL argument IS the ExecContext argument,
	// and the call's own closing paren sits after the last Go value, so
	// requiring depth one would never terminate at the statement and would run
	// the split over the whole rest of the file.
	in := true
	depth := 0
	end := -1
	for i := open + 1; i < len(body); i++ {
		c := body[i]
		if c == '"' {
			in = !in
			continue
		}
		if in {
			continue
		}
		switch c {
		case '(':
			depth++
		case ')':
			depth--
		case ',':
			if end < 0 && depth == 0 {
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
	i := end + 1
	for i < len(body) {
		if body[i] == ' ' || body[i] == '\t' || body[i] == '\n' || body[i] == ',' {
			i++
			continue
		}
		break
	}
	var args []string
	depth = 0
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
