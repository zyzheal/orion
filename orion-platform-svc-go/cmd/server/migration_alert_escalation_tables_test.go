package main

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// The alert-escalation module is wired on every boot and fifteen routes are
// registered under /alert-escalation. It owns four relations that no other
// module reads: escalation_policy, escalation_trigger, alert_closure and
// alert_metrics. 397 declares all four and nothing else touches them, so 397
// alone is the whole contract the repository reads against.
//
// The checks below derive the repository's column lists, its three UPDATE
// whitelists, its four INSERT column sets, its model db tags and its metric
// binding keys out of the Go source and compare them with what 397 declares, so
// the two halves cannot drift apart again.

var (
	// The alternation is deliberately exact and is always followed by \s: 572 has
	// an escalation_policies (plural) inside a guarded DO block, and a prefix
	// match would pull that guarded addition into the checks as a real one.
	reAETable  = "(escalation_policy|escalation_trigger|alert_closure|alert_metrics)"
	reAECreate = regexp.MustCompile(`(?s)CREATE TABLE(?:\s+IF NOT EXISTS)? ` + reAETable + `\s*\(([^;]+?)\);`)
	// reAEAddColumns must not wrap reAETable in its own parentheses: that
	// alternation already captures, so wrapping it moves the statement body from
	// group two to group three and the fold silently sees no ADD COLUMN.
	reAEAddColumns = regexp.MustCompile(`(?is)ALTER TABLE ` + reAETable + `\s([^;]*);`)
	// reAEInsert is anchored on each INSERT's own column list. The bound values
	// come out of the shared args-after-statement walker rather than of the SQL,
	// so the arity check cannot be satisfied by a hand-transcribed column list.
	reAEInsert = regexp.MustCompile(`(?s)INSERT INTO ` + reAETable + `\s*\(([^)]+)\)`)
	// The column-list consts, the update whitelists and the metric binding keys
	// are read out of the source rather than restated here.
	reAEColumnsConst = regexp.MustCompile(`(policyColumns|triggerColumns|closureColumns|metricsColumns)\s*=\s*` + "`([^`]+)`")
	reAEUpdatable    = regexp.MustCompile(`(policyUpdatable|triggerUpdatable|closureUpdatable)\s*=\s*\[\]string\{([^}]*)\}`)
	reAEBindingKey   = regexp.MustCompile(`\{"([a-zA-Z0-9]+)",\s*func\(`)
	// reAENotNullColumn takes the column name and its type apart, so it works for
	// every declared type: 397 declares level as INT NOT NULL and mttr_seconds
	// as BIGINT NOT NULL would, and the shared reNotNullColumn used by the
	// runbook checks does not spell INT or BIGINT out.
	reAENotNullColumn = regexp.MustCompile(`(?i)^\s*(\w+)\s+([A-Za-z]+(?:\(\d+\))?)(.*)NOT NULL`)
	reAEColumnDecl    = regexp.MustCompile(`(?i)^\s*(\w+)\s+([A-Za-z]+(?:\(\d+\))?)(.*)`)
	// The keyword has to be followed by a space, a paren or the end of line, so a
	// column whose name starts with a SQL keyword is not mistaken for a
	// constraint.
	reAEConstraint = regexp.MustCompile(`(?i)^(PRIMARY\s+KEY|UNIQUE|CONSTRAINT|CHECK|FOREIGN\s+KEY|CREATE\s+INDEX|INDEX|KEY)(\s|\(|$)`)
	reAEJSON       = regexp.MustCompile(`(?i)^\s*(JSON|JSONB)\s*$`)
	// reAEField pairs a struct field's Go type with its db tag, which is what a
	// NULL-scan and a safe-mode-sqlx check need.
	reAEField = regexp.MustCompile("^\\s*(\\w+)\\s+(\\*?[A-Za-z0-9.]+)\\s+`db:\"([a-z0-9_]+)\"")
	// reAECamel turns a camelCase stat key into the column it must map onto:
	// p95ResponseSeconds is p95_response_seconds, not p95response_seconds.
	reAECamel = regexp.MustCompile(`([a-z0-9])([A-Z])`)
)

func aeSourceFiles(t *testing.T) []migrationFile {
	t.Helper()
	var out []migrationFile
	err := filepath.WalkDir("../../internal/alert-escalation", func(path string, d os.DirEntry, err error) error {
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

func aeSnake(s string) string {
	return strings.ToLower(reAECamel.ReplaceAllString(s, "${1}_${2}"))
}

// aeDDL gathers, per table, its columns in declaration order, each column's
// declared type, and which of them are NOT NULL. One pass over the same CREATE
// blocks, so the three views cannot disagree with each other. 397 has no ALTER
// for these four tables, so the additions pass is expected to be empty and is
// kept only to prove that stays true.
func aeDDL(t *testing.T) (map[string][]string, map[string]map[string]string, map[string]map[string]bool) {
	ordered := map[string][]string{}
	types := map[string]map[string]string{}
	notNull := map[string]map[string]bool{}
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range reAECreate.FindAllStringSubmatch(f.body, -1) {
			table, block := m[1], m[2]
			if ordered[table] != nil {
				t.Errorf("%s is CREATEd more than once; the second is outside 397", table)
				continue
			}
			ordered[table] = []string{}
			types[table] = map[string]string{}
			notNull[table] = map[string]bool{}
			for _, line := range strings.Split(block, "\n") {
				c := reAEColumnDecl.FindStringSubmatch(line)
				if c == nil || !aeIsColumnLine(line) {
					continue
				}
				col, typ := c[1], strings.ToUpper(c[2])
				if _, dup := types[table][col]; dup {
					continue
				}
				ordered[table] = append(ordered[table], col)
				types[table][col] = typ
				if reAENotNullColumn.MatchString(line) {
					notNull[table][col] = true
				}
			}
		}
	}
	// The additions are a separate second pass: entriesInMigrationsDir does not
	// sort, so an ADD could otherwise be walked before its CREATE.
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range reAEAddColumns.FindAllStringSubmatch(f.body, -1) {
			table := m[1]
			if ordered[table] == nil {
				continue
			}
			ordered[table] = append(ordered[table], reAEColumnDecl.FindStringSubmatch(m[2])[1])
		}
	}
	return ordered, types, notNull
}

func aeIsColumnLine(line string) bool {
	return !reAEConstraint.MatchString(strings.ToUpper(strings.TrimSpace(line)))
}

// aeModelFields maps each DB-tagged struct to its db tag and its Go type, read
// out of models.go. The request structs carry no db tags, so they do not appear
// here and cannot be confused with a relation.
func aeModelFields(t *testing.T) map[string]map[string]string {
	t.Helper()
	out := map[string]map[string]string{}
	for _, f := range aeSourceFiles(t) {
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
				m := reAEField.FindStringSubmatch(lines[j])
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
// migration, and no other migration may add columns to any of the four: an
// ALTER would leave the repository's column lists behind and safe-mode sqlx
// would then fail the whole read.
func TestMigrationsCreateEveryAlertEscalationRelation(t *testing.T) {
	creators := map[string][]string{}
	adders := map[string][]string{}
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range reAECreate.FindAllStringSubmatch(f.body, -1) {
			creators[m[1]] = append(creators[m[1]], f.name)
		}
		for _, m := range reAEAddColumns.FindAllStringSubmatch(f.body, -1) {
			adders[m[1]] = append(adders[m[1]], f.name)
		}
	}

	want := map[string]bool{}
	for _, src := range aeSourceFiles(t) {
		for _, m := range reAEInsert.FindAllStringSubmatch(src.body, -1) {
			want[m[1]] = true
		}
	}
	if len(want) != 4 {
		t.Fatalf("expected the four alert-escalation relations, found %d: %v", len(want), sortedSetKeys(want))
	}
	for _, table := range sortedSetKeys(want) {
		got := creators[table]
		if len(got) != 1 || got[0] != "397_create_alert_escalation.sql" {
			t.Errorf("%s is created by %v, want 397_create_alert_escalation.sql only", table, got)
		}
	}
	// 572 names escalation_policies in a guarded DO block. The \s boundary in
	// reAEAddColumns keeps that plural table out, which is what this pin asserts.
	if len(adders) != 0 {
		t.Errorf("column additions outside 397 would desync the column lists: %v", sortedKeys(adders))
	}
}

// The four SELECT column lists must be 397's own column sets, in order. Dropping
// a column would make the read return a zero field; adding one 397 does not
// declare would fail the statement outright.
func TestAlertEscalationColumnListsMatchMigration397(t *testing.T) {
	ordered, _, _ := aeDDL(t)
	joined := strings.Join(bodiesOf(aeSourceFiles(t)), "\n")

	wantTable := map[string]string{
		"policyColumns":  "escalation_policy",
		"triggerColumns": "escalation_trigger",
		"closureColumns": "alert_closure",
		"metricsColumns": "alert_metrics",
	}
	matches := reAEColumnsConst.FindAllStringSubmatch(joined, -1)
	if len(matches) != 4 {
		t.Fatalf("expected four column-list consts, found %d", len(matches))
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
			t.Errorf("%s names %d columns for %s, 397 declares %d: %v", name, len(got), table, len(want), got)
			continue
		}
		for i := range want {
			if got[i] != want[i] {
				t.Errorf("%s position %d is %q, 397 declares %q for %s", name, i+1, got[i], want[i], table)
			}
		}
	}
	for name := range wantTable {
		if !seen[name] {
			t.Errorf("the %s column list was not found", name)
		}
	}
}

// Every INSERT must name the table's whole column set in order, must bind one
// value per column, and every NOT NULL column must be bound by value. The NOT
// NULL sets are pinned too: an INSERT that named every column would silently
// keep working after a NOT NULL in 397 was relaxed, and then a zero-value write
// would become legal with no statement-level check noticing.
func TestAlertEscalationInsertsFitTheMigratedSchema(t *testing.T) {
	ordered, _, notNull := aeDDL(t)
	consts := map[string][]string{}
	for _, m := range reAEColumnsConst.FindAllStringSubmatch(strings.Join(bodiesOf(aeSourceFiles(t)), "\n"), -1) {
		consts[m[1]] = splitList(m[2])
	}
	files := aeSourceFiles(t)
	seen := map[string]bool{}
	n := 0
	for _, f := range files {
		idx := reAEInsert.FindAllStringSubmatchIndex(f.body, -1)
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
				t.Errorf("%s INSERT names %d columns, 397 declares %d: %v", table, len(cols), len(want), cols)
				continue
			}
			for i := range want {
				if cols[i] != want[i] {
					t.Errorf("%s INSERT position %d is %q, 397 declares %q", table, i+1, cols[i], want[i])
				}
			}
			if len(vals) != len(cols) {
				t.Errorf("%s INSERT binds %d values for %d columns: %v", table, len(vals), len(cols), vals)
				continue
			}
			// A NOT NULL column left out of the column list would lean on 397's
			// DEFAULT and silently record a row that never carried the value.
			for col := range notNull[table] {
				found := false
				for _, c := range cols {
					if c == col {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("%s INSERT omits %s, which 397 declares NOT NULL", table, col)
				}
			}
		}
	}
	if n != 4 {
		t.Fatalf("expected four INSERT statements, found %d", n)
	}
	for table := range ordered {
		if !seen[table] {
			t.Errorf("no INSERT names %s", table)
		}
	}

	wantNotNull := map[string][]string{
		"escalation_policy": {"id", "tenant_id", "name", "severity", "status", "rules", "created_at", "updated_at"},
		"escalation_trigger": {"id", "tenant_id", "policy_id", "alert_id", "level", "target",
			"channel", "triggered_at", "status"},
		"alert_closure": {"id", "tenant_id", "alert_id", "status", "created_at", "updated_at"},
		"alert_metrics": {"id", "tenant_id", "metric_date", "total_alerts", "acknowledged_count",
			"resolved_count", "escalated_count", "avg_response_seconds", "avg_resolution_seconds",
			"p95_response_seconds", "p95_resolution_seconds", "sla_breach_count",
			"auto_remediation_success", "auto_remediation_failed", "created_at"},
	}
	for _, table := range sortedSetKeys(wantNotNull) {
		want := wantNotNull[table]
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
				t.Errorf("%s no longer declares %s NOT NULL", table, c)
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

// The update whitelists are the injection boundary of the three UPDATE
// statements. A column 397 does not declare would fail the UPDATE, and an
// identity column would let a caller re-point a row at another tenant or policy.
func TestAlertEscalationUpdateWhitelistsNameOnlyRealColumns(t *testing.T) {
	ordered, _, _ := aeDDL(t)
	joined := strings.Join(bodiesOf(aeSourceFiles(t)), "\n")

	wantTable := map[string]string{
		"policyUpdatable":  "escalation_policy",
		"triggerUpdatable": "escalation_trigger",
		"closureUpdatable": "alert_closure",
	}
	// alert_metrics has no UPDATE in the module: metrics are append-only, and a
	// whitelist for it would name a statement that does not exist.
	never := map[string]map[string]bool{
		"escalation_policy":  {"id": true, "tenant_id": true},
		"escalation_trigger": {"id": true, "tenant_id": true, "policy_id": true},
		"alert_closure":      {"id": true, "tenant_id": true, "alert_id": true},
	}
	// Pinned as well as validated: a whitelist change is a security decision, not
	// a formatting one, so both adding and dropping a column must be visible.
	wantCols := map[string][]string{
		"policyUpdatable":  {"name", "description", "severity", "status", "rules", "updated_at"},
		"triggerUpdatable": {"level", "target", "channel", "message", "triggered_at", "status", "resolved_at"},
		"closureUpdatable": {"status", "acknowledged_by", "acknowledged_at", "resolved_by", "resolved_at",
			"resolution_note", "mttr_seconds", "updated_at"},
	}
	matches := reAEUpdatable.FindAllStringSubmatch(joined, -1)
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
				t.Errorf("%s allows %s, which 397 does not declare for %s", name, c, table)
			}
			if never[table][c] {
				t.Errorf("%s allows %s, which is identity and would re-scope the row", name, c)
			}
		}
		want := wantCols[name]
		if len(cols) != len(want) {
			t.Errorf("%s has %d entries, want %d: %v", name, len(cols), len(want), cols)
			continue
		}
		for i := range want {
			if strings.Trim(cols[i], "\"' ") != want[i] {
				t.Errorf("%s position %d is %q, want %q", name, i+1, strings.Trim(cols[i], "\"' "), want[i])
			}
		}
	}
	for name := range wantTable {
		if !seen[name] {
			t.Errorf("the %s whitelist was not found", name)
		}
	}
}

// The model structs are the scan targets, so every db tag must name a column
// 397 declares and the four structs must together cover every column of the four
// tables. Safe-mode sqlx fails the whole read on a missing field, so an extra db
// tag is a silent outage; a missing one is a silently zero field.
func TestAlertEscalationModelFieldsCoverEveryColumn(t *testing.T) {
	ordered, _, _ := aeDDL(t)
	fields := aeModelFields(t)

	wantStruct := map[string]string{
		"escalation_policy":  "EscalationPolicy",
		"escalation_trigger": "EscalationTrigger",
		"alert_closure":      "AlertClosure",
		"alert_metrics":      "AlertMetrics",
	}
	covered := map[string]bool{}
	for _, table := range sortedSetKeys(wantStruct) {
		structName := wantStruct[table]
		fld, ok := fields[structName]
		if !ok {
			t.Errorf("the model struct %s was not found", structName)
			continue
		}
		want := ordered[table]
		if len(fld) != len(want) {
			t.Errorf("%s has %d db-tagged fields for %s, 397 declares %d columns: %v",
				structName, len(fld), table, len(want), sortedSetKeys(fld))
			continue
		}
		for _, col := range want {
			if _, has := fld[col]; !has {
				t.Errorf("%s has no field for %s, so that column never reaches the response", structName, col)
			}
			covered[table+"."+col] = true
		}
	}
	wantCols := len(ordered["escalation_policy"]) + len(ordered["escalation_trigger"]) +
		len(ordered["alert_closure"]) + len(ordered["alert_metrics"])
	if len(covered) != wantCols {
		t.Errorf("models cover %d of %d columns: %v", len(covered), wantCols, sortedSetKeys(covered))
	}
}

// escalation_policy.rules is the one JSON column, and it is NOT NULL, so the
// field that scans it must be able to receive a value and must not be the
// nil-swallowing Text type: Postgres refuses an empty string there, and a Text
// field would turn an absent value into the empty string that the constraint
// rejects.
func TestAlertEscalationJSONColumnsMatchTheirModelFields(t *testing.T) {
	_, types, notNull := aeDDL(t)
	fields := aeModelFields(t)

	wantStruct := map[string]string{
		"escalation_policy": "EscalationPolicy",
	}
	wantJSON := map[string]bool{"escalation_policy.rules": true}
	found := map[string]bool{}
	for table, cols := range types {
		for col, typ := range cols {
			if reAEJSON.MatchString(typ) {
				found[table+"."+col] = true
			}
		}
	}
	if len(found) != len(wantJSON) {
		t.Errorf("found %d JSON columns, want %d: %v", len(found), len(wantJSON), sortedSetKeys(found))
	}
	for k := range wantJSON {
		table, col := splitOne(k, ".")
		if !found[k] {
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
			t.Errorf("%s has no field to scan into", k)
			continue
		}
		if got != "string" {
			t.Errorf("%s scans into %s, want string: a NOT NULL JSON column cannot scan into a pointer or a nil-swallowing type", k, got)
		}
	}
}

// The statement sources must use Postgres placeholders. A ? placeholder against
// lib/pq is a syntax error at the driver level, so every method in the module
// would fail before it could touch a row.
func TestAlertEscalationStatementsUsePostgresPlaceholders(t *testing.T) {
	for _, f := range aeSourceFiles(t) {
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

// metricBindings is the whole numeric surface of alert_metrics: a key that maps
// onto no column is dropped on the way to the row, and a numeric column with no
// key stays at its DEFAULT for every day forever.
func TestAlertEscalationMetricBindingsCoverEveryNumericColumn(t *testing.T) {
	ordered, _, notNull := aeDDL(t)
	fields := aeModelFields(t)

	consts := map[string][]string{}
	for _, m := range reAEColumnsConst.FindAllStringSubmatch(strings.Join(bodiesOf(aeSourceFiles(t)), "\n"), -1) {
		consts[m[1]] = splitList(m[2])
	}
	if _, ok := consts["metricsColumns"]; !ok {
		t.Fatalf("the metricsColumns const was not found")
	}
	identity := map[string]bool{"id": true, "tenant_id": true, "metric_date": true, "created_at": true}
	wantNumeric := []string{}
	for _, c := range consts["metricsColumns"] {
		if !identity[c] {
			wantNumeric = append(wantNumeric, c)
		}
	}
	sort.Strings(wantNumeric)

	joined := strings.Join(bodiesOf(aeSourceFiles(t)), "\n")
	matches := reAEBindingKey.FindAllStringSubmatch(joined, -1)
	if len(matches) != len(wantNumeric) {
		t.Fatalf("expected %d metric bindings, found %d", len(wantNumeric), len(matches))
	}
	mapped := map[string]bool{}
	declared := map[string]bool{}
	for _, c := range ordered["alert_metrics"] {
		declared[c] = true
	}
	for _, m := range matches {
		key := m[1]
		col := aeSnake(key)
		mapped[col] = true
		if !declared[col] {
			t.Errorf("metricBindings key %q maps to %s, which 397 does not declare for alert_metrics", key, col)
		}
		if col == "metric_date" || !notNull["alert_metrics"][col] {
			t.Errorf("metricBindings key %q maps to %s, which is not a NOT NULL numeric column", key, col)
		}
	}
	for _, c := range wantNumeric {
		if !mapped[c] {
			t.Errorf("alert_metrics.%s has no metricBindings key, so it is never written", c)
		}
	}

	// Every numeric column must also have a model field of an integer type, so a
	// rename on either side fails here instead of at the driver.
	am, ok := fields["AlertMetrics"]
	if !ok {
		t.Fatalf("the AlertMetrics struct was not found")
	}
	for _, c := range wantNumeric {
		got, has := am[c]
		if !has {
			t.Errorf("alert_metrics.%s has no model field", c)
			continue
		}
		if got != "int" && got != "int64" {
			t.Errorf("alert_metrics.%s is bound as %s, want an integer type", c, got)
		}
	}
}
