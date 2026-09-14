package main

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// The runbook module is wired on every boot -- wireRunbook runs
// unconditionally and seven routes are registered under /runbooks -- and its
// repository writes three relations. No migration created two of them, and the
// one that 172_create_runbook_tables.sql did create uses a completely
// different column set from the one the repository writes, so every endpoint
// died at the SQL layer. The tests below derive the required relation and
// column set out of the Go source so a statement and a migration can never
// drift apart again.

var (
	// reRunbookRel names every relation the module's SQL mentions. Every runbook
	// relation is prefixed with runbook, which also keeps English prose from
	// comments -- "it lists the ...", "update it itself" -- out of the set.
	reRunbookRel = regexp.MustCompile(`(?i)(?:FROM|INTO|UPDATE|TABLE(?:\s+IF NOT EXISTS)?)\s+(runbook[a-z0-9_]*)`)
	// reRunbookInsert is anchored on the single-line column list the repository
	// uses for both INSERTs.
	reRunbookInsert = regexp.MustCompile(`INSERT INTO (runbooks|runbook_executions)\s*\(([^)\n]+)\)`)
	// reRunbookCreate captures one table's own parenthesised block, so a
	// sibling table's identically named column cannot satisfy a check on this
	// one.
	reRunbookCreate      = regexp.MustCompile(`(?s)CREATE TABLE(?:\s+IF NOT EXISTS)? (runbooks|runbook_executions|runbook_execution_steps)\s*\(([^;]+?)\);`)
	reRunbookAddColumn   = regexp.MustCompile(`(?i)ALTER TABLE runbooks ADD COLUMN IF NOT EXISTS (\w+)\s+([^;]+);`)
	reRunbookDropNotNull = regexp.MustCompile(`(?i)ALTER TABLE runbooks ALTER COLUMN (\w+) DROP NOT NULL`)
	reRunbookSetNotNull  = regexp.MustCompile(`(?i)ALTER TABLE runbooks ALTER COLUMN (\w+) SET NOT NULL`)
	reRunbookCreateIndex = regexp.MustCompile(`(?i)CREATE INDEX IF NOT EXISTS ([a-z_0-9]+) ON (runbooks|runbook_executions|runbook_execution_steps)\b`)
	reRunbookDropIndex   = regexp.MustCompile(`(?i)DROP INDEX IF EXISTS "?([a-z_0-9]+)"?`)
	reRunbookDropTable   = regexp.MustCompile(`(?i)DROP TABLE IF EXISTS (runbooks|runbook_executions|runbook_execution_steps)`)
	reRunbookDropColumn  = regexp.MustCompile(`(?i)ALTER TABLE runbooks DROP COLUMN IF EXISTS (\w+)`)
	// reNotNullColumn catches a NOT NULL declaration whether it lives in a
	// CREATE TABLE block or in an ADD COLUMN statement.
	reNotNullColumn = regexp.MustCompile(`(?i)^\s*(\w+)\s+(?:VARCHAR\(\d+\)|TEXT|JSONB|BOOLEAN|UUID|INTEGER|TIMESTAMP WITH TIME ZONE)\s+NOT NULL`)
	// The two column-list consts and the update whitelist are read out of the
	// source rather than restated here.
	reRunbookColumnsConst   = regexp.MustCompile("runbookColumns\\s*=\\s*`([^`]+)`")
	reExecutionColumnsConst = regexp.MustCompile("executionColumns\\s*=\\s*`([^`]+)`")
	reRunbookUpdatable      = regexp.MustCompile(`runbookUpdatable\s*=\s*\[\]string\{([^}]*)\}`)
)

func runbookSourceFiles(t *testing.T) []string {
	t.Helper()
	var out []string
	err := filepath.WalkDir("../../internal/runbook", func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		b, rerr := os.ReadFile(path)
		if rerr != nil {
			return nil
		}
		out = append(out, string(b))
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return out
}

func migrationBody(t *testing.T, name string) string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("../../migrations", name))
	if err != nil {
		t.Fatalf("migration %s: %v", name, err)
	}
	return string(b)
}

// Every relation the module's SQL mentions must be created by exactly one
// forward migration. Zero creators is the defect this round closed; two means
// a later migration silently redefines what an earlier one promised.
func TestMigrationsCreateEveryRunbookRelation(t *testing.T) {
	want := map[string]bool{}
	for _, src := range runbookSourceFiles(t) {
		for _, m := range reRunbookRel.FindAllStringSubmatch(src, -1) {
			want[m[1]] = true
		}
	}
	if len(want) == 0 {
		t.Fatal("no runbook relation was found in the module source")
	}

	creators := map[string][]string{}
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range reRunbookCreate.FindAllStringSubmatch(f.body, -1) {
			creators[m[1]] = append(creators[m[1]], f.name)
		}
	}
	for table := range want {
		n := len(creators[table])
		if n == 0 {
			t.Errorf("relation %q is referenced by the runbook module but no migration creates it", table)
		} else if n > 1 {
			t.Errorf("relation %q is created by %d migrations: %v", table, n, sortedKeysSingle(creators, table))
		}
	}
}

// The accumulated schema must admit every INSERT the repository issues: each
// column it names has to be declared, and every NOT NULL column it leaves out
// has to have been relaxed. Migration 172 declared name and value NOT NULL
// with no default and the repository never supplies either, which was the
// second reason POST /runbooks could not succeed.
func TestRunbookStatementsFitTheMigratedSchema(t *testing.T) {
	declared := map[string]map[string]string{} // table -> column -> declaration
	created := map[string]string{}
	added := map[string]string{}
	notNull := map[string]map[string]bool{}
	relaxed := map[string]bool{}

	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range reRunbookCreate.FindAllStringSubmatch(f.body, -1) {
			table, block := m[1], m[2]
			created[table] = f.name
			declared[table] = map[string]string{}
			notNull[table] = map[string]bool{}
			for _, col := range splitDDLColumns(block) {
				declared[table][col] = ""
			}
			// NOT NULL applies whichever line of the block declared it, so scan
			// the raw block rather than the already-split column names.
			for _, line := range strings.Split(block, "\n") {
				if c := reNotNullColumn.FindStringSubmatch(line); c != nil {
					notNull[table][c[1]] = true
				}
			}
		}
		for _, m := range reRunbookAddColumn.FindAllStringSubmatch(f.body, -1) {
			col, typ := m[1], strings.TrimSpace(m[2])
			declared["runbooks"] = declaredOr(declared, "runbooks")
			declared["runbooks"][col] = typ
			added["runbooks."+col] = f.name
			if strings.Contains(strings.ToUpper(typ), "NOT NULL") {
				notNull["runbooks"] = notNullOr(notNull, "runbooks")
				notNull["runbooks"][col] = true
			}
		}
		for _, m := range reRunbookDropNotNull.FindAllStringSubmatch(f.body, -1) {
			relaxed[m[1]] = true
		}
	}

	// The two relations created by 586 must not already exist elsewhere.
	for _, table := range []string{"runbook_executions", "runbook_execution_steps"} {
		if got := created[table]; got != "586_align_runbook_tables.sql" {
			t.Errorf("%s is created by %q, want 586_align_runbook_tables.sql", table, got)
		}
	}
	if got := created["runbooks"]; got != "172_create_runbook_tables.sql" {
		t.Errorf("runbooks is created by %q, want 172_create_runbook_tables.sql", got)
	}
	if len(added) != 8 {
		t.Errorf("586 adds %d columns to runbooks, want 8: %v", len(added), sortedKeysSingleMap(added))
	}

	inserted := map[string][]string{}
	for _, src := range runbookSourceFiles(t) {
		for _, m := range reRunbookInsert.FindAllStringSubmatch(src, -1) {
			table := m[1]
			cols := strings.Split(m[2], ",")
			for i := range cols {
				cols[i] = strings.TrimSpace(cols[i])
			}
			inserted[table] = cols
		}
	}
	if len(inserted["runbooks"]) != 13 {
		t.Fatalf("the runbooks INSERT names %d columns, want 13: %v", len(inserted["runbooks"]), inserted["runbooks"])
	}
	if len(inserted["runbook_executions"]) != 9 {
		t.Fatalf("the runbook_executions INSERT names %d columns, want 9: %v", len(inserted["runbook_executions"]), inserted["runbook_executions"])
	}

	for table, cols := range inserted {
		declared[table] = declaredOr(declared, table)
		supplied := map[string]bool{}
		for _, c := range cols {
			supplied[c] = true
			if _, ok := declared[table][c]; !ok {
				t.Errorf("%s: column %q is INSERTed but no migration declares it", table, c)
			}
		}
		var missing []string
		for c := range notNull[table] {
			if !supplied[c] && !relaxed[c] {
				missing = append(missing, c)
			}
		}
		sort.Strings(missing)
		if len(missing) > 0 {
			t.Errorf("%s: NOT NULL columns %v are neither INSERTed nor relaxed", table, missing)
		}
	}
	if !relaxed["name"] || !relaxed["value"] {
		t.Errorf("name and value are declared NOT NULL by 172 and never INSERTed, so 586 must relax both: relaxed=%v", keys(relaxed))
	}
}

// Every column the repository reads or allows a caller to write must exist in
// the accumulated schema. Reading a missing column is a 500; allowing a caller
// to write a missing one is a 500 with a misleading message.
func TestRunbookColumnsTheRepositoryReadsExist(t *testing.T) {
	declared := map[string]map[string]string{}
	created := map[string]string{}
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range reRunbookCreate.FindAllStringSubmatch(f.body, -1) {
			created[m[1]] = f.name
			declared[m[1]] = map[string]string{}
			for _, col := range splitDDLColumns(m[2]) {
				declared[m[1]][col] = ""
			}
		}
		for _, m := range reRunbookAddColumn.FindAllStringSubmatch(f.body, -1) {
			declared["runbooks"] = declaredOr(declared, "runbooks")
			declared["runbooks"][m[1]] = m[2]
		}
	}

	src := strings.Join(runbookSourceFiles(t), "\n")

	check := func(kind, table, list string) {
		for _, raw := range strings.Split(list, ",") {
			// TrimSpace first: the whitelist is a slice literal, so its entries
			// are quoted, and a Trim whose cutset omits the newline would stop at
			// the leading whitespace and leave the quote in place.
			col := strings.Trim(strings.TrimSpace(raw), "\"' ")
			if col == "" {
				continue
			}
			// An alias "a AS b" names column a; the alias itself is not a column.
			if i := strings.Index(strings.ToLower(col), " as "); i >= 0 {
				col = strings.TrimSpace(col[:i])
			}
			if col == "" {
				continue
			}
			if _, ok := declared[table][col]; !ok {
				t.Errorf("%s names column %q of %s, which no migration declares", kind, col, table)
			}
		}
	}

	if m := reRunbookColumnsConst.FindStringSubmatch(src); m == nil {
		t.Fatal("runbookColumns const not found")
	} else {
		check("runbookColumns", "runbooks", m[1])
	}
	if m := reExecutionColumnsConst.FindStringSubmatch(src); m == nil {
		t.Fatal("executionColumns const not found")
	} else {
		check("executionColumns", "runbook_executions", m[1])
	}
	if m := reRunbookUpdatable.FindStringSubmatch(src); m == nil {
		t.Fatal("runbookUpdatable whitelist not found")
	} else {
		check("runbookUpdatable", "runbooks", m[1])
	}

	// The Delete statement reaches into runbook_execution_steps by
	// execution_id; that column must be declared or the cascade delete is a
	// 500.
	if !strings.Contains(src, "DELETE FROM runbook_execution_steps WHERE execution_id IN") {
		t.Fatal("the Delete cascade on runbook_execution_steps was not found")
	}
	if _, ok := declared["runbook_execution_steps"]["execution_id"]; !ok {
		t.Error("runbook_execution_steps has no execution_id column, so Delete cannot cascade")
	}
	_ = created
}

// The down migration must undo every statement 586 makes, in both directions.
// 172's own down file drops only its two indexes and never the table, so this
// is not an established local convention.
func TestMigration586DownReversesItsForwardStatements(t *testing.T) {
	up := migrationBody(t, "586_align_runbook_tables.sql")
	dn := migrationBody(t, "586_align_runbook_tables_down.sql")

	for _, m := range reRunbookAddColumn.FindAllStringSubmatch(up, -1) {
		if !reRunbookDropColumn.MatchString(dn) || !strings.Contains(dn, "DROP COLUMN IF EXISTS "+m[1]) {
			t.Errorf("586 adds %s but the down migration never drops it", m[1])
		}
	}
	for _, m := range reRunbookCreate.FindAllStringSubmatch(up, -1) {
		if !strings.Contains(dn, "DROP TABLE IF EXISTS "+m[1]) {
			t.Errorf("586 creates %s but the down migration never drops it", m[1])
		}
	}
	for _, m := range reRunbookCreateIndex.FindAllStringSubmatch(up, -1) {
		if !reRunbookDropIndex.MatchString(dn) || !strings.Contains(dn, m[1]) {
			t.Errorf("586 creates index %s but the down migration never drops it", m[1])
		}
	}
	for _, m := range reRunbookDropNotNull.FindAllStringSubmatch(up, -1) {
		if !strings.Contains(dn, "ALTER COLUMN "+m[1]+" SET NOT NULL") {
			t.Errorf("586 relaxes %s but the down migration does not re-tighten it", m[1])
		}
	}
	if n := len(reRunbookCreateIndex.FindAllStringSubmatch(up, -1)); n != 4 {
		t.Errorf("586 creates %d indexes, want 4", n)
	}
}

// --- helpers for the checks above ---

func splitDDLColumns(block string) []string {
	var out []string
	for _, line := range strings.Split(block, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "--") || strings.HasPrefix(strings.ToUpper(line), "PRIMARY KEY") ||
			strings.HasPrefix(strings.ToUpper(line), "UNIQUE") || strings.HasPrefix(strings.ToUpper(line), "CONSTRAINT") ||
			strings.HasPrefix(strings.ToUpper(line), "CREATE INDEX") {
			continue
		}
		if i := strings.Index(line, " "); i > 0 {
			out = append(out, strings.ToLower(strings.TrimSpace(line[:i])))
		}
	}
	return out
}

func notNullOr(m map[string]map[string]bool, table string) map[string]bool {
	if _, ok := m[table]; !ok {
		m[table] = map[string]bool{}
	}
	return m[table]
}

func declaredOr(m map[string]map[string]string, table string) map[string]string {
	if _, ok := m[table]; !ok {
		m[table] = map[string]string{}
	}
	return m[table]
}

func sortedKeysSingle(m map[string][]string, key string) []string {
	return m[key]
}

func sortedKeysSingleMap(m map[string]string) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
