package main

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// The tracing module is wired on every boot -- wireTracing runs unconditionally
// and ten routes are registered under /tracing -- and it reads and writes three
// relations that 195_create_tracing_tables.sql does create. Every one of its
// endpoints nevertheless died at the SQL layer, and the DDL half of the fix is
// two VARCHAR(255) columns that cannot hold their payloads. The checks below
// derive the required relation and column set out of the Go source so a
// statement and a migration can never drift apart again.

var (
	// reTracingRel names every relation the module's SQL mentions. All three are
	// prefixed with trace_ or are the module's own otel_collector_configs, which
	// keeps English prose out of the set.
	reTracingRel = regexp.MustCompile(`(?i)(?:FROM|INTO|UPDATE|TABLE(?:\s+IF NOT EXISTS)?)\s+(trace_spans|trace_sampling_configs|otel_collector_configs)`)
	// reTracingInsert is anchored on the column list of each INSERT. The span
	// one spans two lines, so the character class must cross newlines.
	reTracingInsert = regexp.MustCompile(`INSERT INTO (trace_spans|trace_sampling_configs|otel_collector_configs)\s*\(([^)]+)\)`)
	// reTracingCreate captures one table's own parenthesised block, so a
	// sibling table's identically named column cannot satisfy a check on this
	// one.
	reTracingCreate    = regexp.MustCompile(`(?s)CREATE TABLE(?:\s+IF NOT EXISTS)? (trace_spans|trace_sampling_configs|otel_collector_configs)\s*\(([^;]+?)\);`)
	reTracingAddColumn = regexp.MustCompile(`(?i)ALTER TABLE (trace_spans|trace_sampling_configs|otel_collector_configs) ADD COLUMN(?:\s+IF NOT EXISTS)? (\w+)\s+([^;]+);`)
	// 572 writes "ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET
	// NULL" with no IF NOT EXISTS before the column name, so the pattern must not
	// require one.
	// reTracingAlterType is the shape 587 uses to widen a column.
	reTracingAlterType = regexp.MustCompile(`(?i)ALTER TABLE (trace_spans|otel_collector_configs) ALTER COLUMN (\w+) TYPE ([A-Za-z0-9()]+)\s+USING ([^;]+);`)
	// The three column-list consts and the update whitelist are read out of the
	// source rather than restated here.
	reTracingColumnsConst = regexp.MustCompile("(spanColumns|samplingColumns|otelColumns)\\s*=\\s*`([^`]+)`")
	reTracingUpdatable    = regexp.MustCompile(`otelConfigUpdatable\s*=\s*\[\]string\{([^}]*)\}`)
	// reTracingNotNullColumn is a local copy of reNotNullColumn that also
	// recognises BIGINT. status_code and max_spans_per_sec are BIGINT NOT NULL,
	// and the shared pattern silently ignores them.
	reTracingNotNullColumn = regexp.MustCompile(`(?i)^\s*(\w+)\s+(?:VARCHAR\(\d+\)|TEXT|JSONB|BOOLEAN|UUID|INTEGER|BIGINT|TIMESTAMP WITH TIME ZONE)\s+NOT NULL`)
)

func tracingSourceFiles(t *testing.T) []migrationFile {
	t.Helper()
	var out []migrationFile
	err := filepath.WalkDir("../../internal/tracing", func(path string, d os.DirEntry, err error) error {
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

// Every relation the module's SQL mentions must be created by exactly one
// forward migration.
func TestMigrationsCreateEveryTracingRelation(t *testing.T) {
	want := map[string]bool{}
	for _, src := range tracingSourceFiles(t) {
		for _, m := range reTracingRel.FindAllStringSubmatch(src.body, -1) {
			want[m[1]] = true
		}
	}
	if len(want) != 3 {
		t.Fatalf("expected the three tracing relations, found %d: %v", len(want), keys(want))
	}

	creators := map[string][]string{}
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range reTracingCreate.FindAllStringSubmatch(f.body, -1) {
			creators[m[1]] = append(creators[m[1]], f.name)
		}
	}
	for table := range want {
		n := len(creators[table])
		if n == 0 {
			t.Errorf("relation %q is referenced by the tracing module but no migration creates it", table)
		} else if n > 1 {
			t.Errorf("relation %q is created by %d migrations: %v", table, n, creators[table])
		}
	}
	for table := range want {
		if got := creators[table]; len(got) != 1 || got[0] != "195_create_tracing_tables.sql" {
			t.Errorf("%s is created by %v, want 195_create_tracing_tables.sql", table, creators[table])
		}
	}
}

// The accumulated schema must admit every INSERT the repository issues: each
// column it names has to be declared, and every NOT NULL column it leaves out
// has to have been relaxed. 195 declares tags and config_yaml NOT NULL with no
// default, so the repository has to supply both -- which it does, because
// encodeTags returns "{}" rather than "" for an empty tag set.
func TestTracingStatementsFitTheMigratedSchema(t *testing.T) {
	declared := map[string]map[string]bool{}
	notNull := map[string]map[string]bool{}

	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range reTracingCreate.FindAllStringSubmatch(f.body, -1) {
			table, block := m[1], m[2]
			declared[table] = map[string]bool{}
			notNull[table] = map[string]bool{}
			for _, col := range splitDDLColumns(block) {
				declared[table][col] = true
			}
			for _, line := range strings.Split(block, "\n") {
				if c := reTracingNotNullColumn.FindStringSubmatch(line); c != nil {
					notNull[table][c[1]] = true
				}
			}
		}
		for _, m := range reTracingAddColumn.FindAllStringSubmatch(f.body, -1) {
			if declared[m[1]] == nil {
				declared[m[1]] = map[string]bool{}
				notNull[m[1]] = map[string]bool{}
			}
			declared[m[1]][m[2]] = true
		}
	}

	inserted := map[string][]string{}
	for _, src := range tracingSourceFiles(t) {
		for _, m := range reTracingInsert.FindAllStringSubmatch(src.body, -1) {
			cols := strings.Split(m[2], ",")
			for i := range cols {
				cols[i] = strings.TrimSpace(cols[i])
			}
			inserted[m[1]] = cols
		}
	}
	if len(inserted) != 3 {
		t.Fatalf("expected three INSERTs in the tracing module, found %d: %v", len(inserted), sortedSetKeys(inserted))
	}
	wantCols := map[string]int{
		"trace_spans": 11, "trace_sampling_configs": 8, "otel_collector_configs": 9,
	}
	for table, cols := range inserted {
		if wantCols[table] != len(cols) {
			t.Errorf("%s INSERT names %d columns, want %d: %v", table, len(cols), wantCols[table], cols)
		}
		for _, c := range cols {
			if !declared[table][c] {
				t.Errorf("%s: column %q is INSERTed but no migration declares it", table, c)
			}
		}
		supplied := map[string]bool{}
		for _, c := range cols {
			supplied[c] = true
		}
		var missing []string
		for c := range notNull[table] {
			if !supplied[c] {
				missing = append(missing, c)
			}
		}
		sort.Strings(missing)
		if len(missing) > 0 {
			t.Errorf("%s: NOT NULL columns %v are neither INSERTed nor relaxed", table, missing)
		}
	}

	// The NOT NULL on tags is what makes encodeTags return "{}" instead of "":
	// an empty string would satisfy a nullable column and fail this one.
	src := strings.Join(bodiesOf(tracingSourceFiles(t)), "\n")
	if !strings.Contains(src, `return "{}"`) {
		t.Error("tags is NOT NULL in 195, so encodeTags must never return an empty string")
	}
}

func bodiesOf(files []migrationFile) []string {
	out := make([]string, 0, len(files))
	for _, f := range files {
		out = append(out, f.body)
	}
	return out
}

// Migration 572 adds created_by and updated_by to all three tracing tables,
// and 195 already declares metadata and deleted_at. Safe-mode sqlx fails the
// whole read as soon as a result column has no matching field, so the
// repository cannot SELECT *. These two halves pin the pair: the columns really
// are present, and the column lists really do skip them.
func TestTracingColumnListsSkipColumnsTheRepositoryCannotScan(t *testing.T) {
	declared := map[string]map[string]bool{}
	addedBy := map[string]string{}
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range reTracingCreate.FindAllStringSubmatch(f.body, -1) {
			if declared[m[1]] == nil {
				declared[m[1]] = map[string]bool{}
			}
			for _, col := range splitDDLColumns(m[2]) {
				declared[m[1]][col] = true
			}
		}
		for _, m := range reTracingAddColumn.FindAllStringSubmatch(f.body, -1) {
			if declared[m[1]] == nil {
				declared[m[1]] = map[string]bool{}
			}
			declared[m[1]][m[2]] = true
			addedBy[m[1]+"."+m[2]] = f.name
		}
	}

	if len(addedBy) != 6 {
		t.Fatalf("572 should add created_by and updated_by to three tables, found %d: %v", len(addedBy), sortedSetKeys(addedBy))
	}
	for table := range declared {
		for _, col := range []string{"created_by", "updated_by", "metadata", "deleted_at"} {
			if !declared[table][col] {
				t.Errorf("%s has no %s column; an explicit column list is not optional once it exists", table, col)
			}
		}
	}
	for k, v := range addedBy {
		if v != "572_add_audit_columns.sql" {
			t.Errorf("%s is added by %q, want 572_add_audit_columns.sql", k, v)
		}
	}

	files := tracingSourceFiles(t)
	joined := strings.Join(bodiesOf(files), "\n")

	matches := reTracingColumnsConst.FindAllStringSubmatch(joined, -1)
	if len(matches) != 3 {
		t.Fatalf("expected three column-list consts, found %d", len(matches))
	}
	seen := map[string]bool{}
	for _, m := range matches {
		seen[m[1]] = true
		for _, col := range []string{"created_by", "updated_by", "metadata", "deleted_at"} {
			if strings.Contains(m[2], col) {
				t.Errorf("%s selects %s, which no struct field declares", m[1], col)
			}
		}
	}
	for _, name := range []string{"spanColumns", "samplingColumns", "otelColumns"} {
		if !seen[name] {
			t.Errorf("the %s column list was not found", name)
		}
	}

	// The check skips comment lines: the spanColumns doc says "explicit rather
	// than SELECT *", and that prose is not a statement. A SELECT * on a real
	// code line still fails here.
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
	if m := reTracingUpdatable.FindStringSubmatch(joined); m == nil {
		t.Fatal("the otelConfigUpdatable whitelist was not found")
	} else {
		for _, raw := range strings.Split(m[1], ",") {
			col := strings.Trim(strings.TrimSpace(raw), "\"' ")
			if col == "" {
				continue
			}
			if !declared["otel_collector_configs"][col] {
				t.Errorf("otelConfigUpdatable allows %s, which no migration declares", col)
			}
		}
	}
}

// 195 declares both payload columns as VARCHAR(255). A JSON tag set and an OTel
// collector YAML both exceed that, so every realistic write died with
// "value too long for type character varying(255)". 587 widens them to TEXT,
// which scans into []byte exactly as VARCHAR does and needs no Go change.
func TestMigration587WidensTheTwoPayloadColumns(t *testing.T) {
	up := migrationBody(t, "587_widen_tracing_text_columns.sql")
	dn := migrationBody(t, "587_widen_tracing_text_columns_down.sql")

	widened := map[string]string{}
	for _, m := range reTracingAlterType.FindAllStringSubmatch(up, -1) {
		widened[m[1]+"."+m[2]] = strings.ToUpper(m[3])
	}
	if len(widened) != 2 {
		t.Fatalf("587 widens %d columns, want 2: %v", len(widened), sortedSetKeys(widened))
	}
	for col, typ := range widened {
		if typ != "TEXT" {
			t.Errorf("587 sets %s to %s, want TEXT", col, typ)
		}
	}
	for _, col := range []string{"trace_spans.tags", "otel_collector_configs.config_yaml"} {
		if _, ok := widened[col]; !ok {
			t.Errorf("587 does not widen %s: %v", col, sortedSetKeys(widened))
		}
	}

	// Both must have been declared VARCHAR(255) NOT NULL to begin with,
	// otherwise the widening has no target.
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range reTracingCreate.FindAllStringSubmatch(f.body, -1) {
			for _, line := range strings.Split(m[2], "\n") {
				for _, want := range []string{"tags VARCHAR(255) NOT NULL", "config_yaml VARCHAR(255) NOT NULL"} {
					if strings.Contains(strings.ToUpper(strings.TrimSpace(line)), strings.ToUpper(want)) {
						if f.name != "195_create_tracing_tables.sql" {
							t.Errorf("%s re-declares %s outside 195", f.name, want)
						}
					}
				}
			}
		}
	}

	reversed := map[string]string{}
	for _, m := range reTracingAlterType.FindAllStringSubmatch(dn, -1) {
		reversed[m[1]+"."+m[2]] = strings.ToUpper(m[3]) + " USING " + strings.TrimSpace(m[4])
	}
	for col := range widened {
		got, ok := reversed[col]
		if !ok {
			t.Errorf("the down migration does not reverse %s", col)
			continue
		}
		if !strings.HasPrefix(got, "VARCHAR(255)") {
			t.Errorf("the down migration restores %s to %s, want VARCHAR(255)", col, got)
		}
		if !strings.Contains(got, "LEFT("+strings.Split(col, ".")[1]+", 255)") {
			t.Errorf("the down migration does not truncate %s with LEFT: %s", col, got)
		}
	}
	if n := len(reLiteralTx.FindAllString(up, -1)); n != 0 {
		t.Errorf("587 contains a literal transaction statement, which would end the runner's transaction")
	}
}
