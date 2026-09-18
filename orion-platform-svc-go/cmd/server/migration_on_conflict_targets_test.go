package main

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// ON CONFLICT (<cols>) needs a unique index or a unique constraint on exactly
// those columns. Postgres answers anything else with
//
//	ERROR: there is no unique or exclusion constraint matching the
//	        ON CONFLICT specification
//
// which is rejected before a row is inserted, so the statement compiles, the
// server starts, and every upsert fails at request time. Nothing in go build,
// go vet or the SQL itself exposes it.
//
// That is what 697_ticket_sla_tracking_unique_ticket_id.sql closes. 245 created
// ticket_sla_tracking with a plain index on ticket_id, repository.UpsertSLATracking
// upserted on that column, and Service.CreateTicket is its only caller - so
// every POST /tickets failed after the ticket row itself was already committed.
//
// This test is the closure for the fix: for every ON CONFLICT target the ticket
// modules reach, some forward migration must declare the matching uniqueness. A
// regression that rewrites an upsert onto a plain column, or a schema change
// that drops the constraint, fails here instead of at the first request.
func TestOnConflictTargetsHaveAUniqueConstraint(t *testing.T) {
	unique := uniqueTuplesByTable(t)

	type target struct {
		file    string
		table   string
		cols    string
		context string
	}
	var targets []target
	onConflictRe := regexp.MustCompile(`ON CONFLICT\s*\(([^)]+)\)`)
	insertRe := regexp.MustCompile(`INSERT INTO\s+([A-Za-z_][A-Za-z0-9_]*)`)

	for _, dir := range []string{"../../internal/ticket", "../../internal/ticketing"} {
		_ = filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
			if err != nil || d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
				return nil
			}
			b, rerr := os.ReadFile(path)
			if rerr != nil {
				return nil
			}
			src := string(b)
			for _, m := range onConflictRe.FindAllStringSubmatchIndex(src, -1) {
				// The ON CONFLICT clause always follows its own INSERT, so the
				// nearest preceding INSERT INTO in the file names the table.
				pre := insertRe.FindAllStringSubmatchIndex(src[:m[0]], -1)
				if len(pre) == 0 {
					continue
				}
				last := pre[len(pre)-1]
				table := src[last[2]:last[3]]
				// normalizeCols sorts as well as lowercases, so ON CONFLICT (a, b)
				// and UNIQUE(b, a) compare equal.
				cols := normalizeCols(src[m[2]:m[3]])
				start := strings.LastIndexAny(src[:m[0]], "\n") + 1
				end := strings.IndexAny(src[m[1]:], "\n")
				if end < 0 {
					end = m[1] + 40
				} else {
					end = m[1] + end
				}
				targets = append(targets, target{path, table, cols, src[start:end]})
			}
			return nil
		})
	}

	if len(targets) == 0 {
		t.Skip("no ON CONFLICT target found in the ticket modules, nothing to close")
	}

	for _, tgt := range targets {
		tuples := unique[tgt.table]
		if len(tuples) == 0 {
			t.Errorf("%s upserts into %s on (%s) but no forward migration declares "+
				"any uniqueness on that table: %s", tgt.file, tgt.table, tgt.cols, tgt.context)
			continue
		}
		if _, ok := tuples[tgt.cols]; !ok {
			t.Errorf("%s upserts into %s on (%s) but no forward migration declares a "+
				"unique index or constraint on exactly those columns; Postgres rejects "+
				"the statement at request time. declared: %v",
				tgt.file, tgt.table, tgt.cols, sortedTuples(tuples))
		}
	}
}

// uniqueTuplesByTable collects every uniqueness a forward migration declares,
// keyed by table and by the sorted, lowercased column list, so
// UNIQUE(tenant_id, engineer_id) and ON CONFLICT (engineer_id, tenant_id)
// compare equal.
func uniqueTuplesByTable(t *testing.T) map[string]map[string]bool {
	t.Helper()
	out := map[string]map[string]bool{}
	add := func(table, cols string) {
		table = strings.ToLower(strings.TrimSpace(table))
		key := normalizeCols(cols)
		if table == "" || key == "" {
			return
		}
		if out[table] == nil {
			out[table] = map[string]bool{}
		}
		out[table][key] = true
	}

	entries, err := os.ReadDir("../../migrations")
	if err != nil {
		t.Fatalf("read migrations dir: %v", err)
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		// Rollbacks would drop the constraint; the invariant is about the
		// forward path, matching TestMigrationsCreateTheExtensionsTheQueriesNeed.
		if strings.HasSuffix(e.Name(), "_down.sql") {
			continue
		}
		b, rerr := os.ReadFile(filepath.Join("../../migrations", e.Name()))
		if rerr != nil {
			continue
		}
		addUniqueness(string(b), add)
	}
	return out
}

var (
	createTableRe       = regexp.MustCompile(`(?is)CREATE TABLE\s+(?:IF NOT EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*?)\);`)
	columnLevelPKRe     = regexp.MustCompile(`(?i)^([A-Za-z_][A-Za-z0-9_]*)\s+[A-Za-z][A-Za-z0-9_]*.*\bPRIMARY KEY\b`)
	columnLevelUniqueRe = regexp.MustCompile(`(?i)^([A-Za-z_][A-Za-z0-9_]*)\s+[A-Za-z][A-Za-z0-9_]*.*\bUNIQUE\s*$`)
	tableConstraintRe   = regexp.MustCompile(`(?i)^(PRIMARY KEY|UNIQUE)\s*\(([^)]+)\)`)
	alterUniqueRe       = regexp.MustCompile(`(?is)ALTER TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\s+ADD\s+(?:CONSTRAINT\s+[A-Za-z_][A-Za-z0-9_]*\s+)?(PRIMARY KEY|UNIQUE)\s*\(([^)]+)\)`)
	uniqueIndexRe       = regexp.MustCompile(`(?is)CREATE\s+UNIQUE\s+INDEX\s+(?:IF NOT EXISTS\s+)?[A-Za-z_][A-Za-z0-9_]*\s+ON\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]+)\)`)
)

// addUniqueness walks one migration and records every uniqueness it declares.
func addUniqueness(sql string, add func(table, cols string)) {
	for _, m := range createTableRe.FindAllStringSubmatch(sql, -1) {
		table, body := m[1], m[2]
		for _, part := range topLevelParts(body) {
			part = strings.TrimSpace(part)
			if c := tableConstraintRe.FindStringSubmatch(part); c != nil {
				add(table, c[2])
				continue
			}
			if c := columnLevelPKRe.FindStringSubmatch(part); c != nil {
				add(table, c[1])
				continue
			}
			if c := columnLevelUniqueRe.FindStringSubmatch(part); c != nil {
				add(table, c[1])
			}
		}
	}
	for _, m := range alterUniqueRe.FindAllStringSubmatch(sql, -1) {
		add(m[1], m[3])
	}
	for _, m := range uniqueIndexRe.FindAllStringSubmatch(sql, -1) {
		add(m[1], m[2])
	}
}

// topLevelParts splits a CREATE TABLE body on commas that sit at paren depth 0,
// so "a INTEGER, b (x, y)" does not tear the second column definition in half.
func topLevelParts(body string) []string {
	var parts []string
	depth := 0
	start := 0
	for i := 0; i < len(body); i++ {
		switch body[i] {
		case '(':
			depth++
		case ')':
			if depth > 0 {
				depth--
			}
		case ',':
			if depth == 0 {
				parts = append(parts, body[start:i])
				start = i + 1
			}
		}
	}
	parts = append(parts, body[start:])
	return parts
}

// normalizeCols lowercases, drops quotes and sorts the columns, so the same
// constraint written in either order resolves to the same key.
func normalizeCols(cols string) string {
	var out []string
	for _, c := range strings.Split(cols, ",") {
		c = strings.TrimSpace(c)
		c = strings.Trim(c, "`\"")
		c = strings.ToLower(c)
		if c != "" {
			out = append(out, c)
		}
	}
	sort.Strings(out)
	return strings.Join(out, ",")
}

func sortedTuples(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
