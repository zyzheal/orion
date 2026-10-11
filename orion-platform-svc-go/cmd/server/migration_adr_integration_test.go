package main

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
)

// Cross-ADR migration integration test.
//
// Consolidates all 14 ADR migrations (ADR-010 ~ ADR-015) into a single
// integrity check that verifies:
//
//  1. Every ADR migration is atomic (BEGIN; + COMMIT;)
//  2. Every CREATE TABLE / ADD COLUMN is idempotent (IF NOT EXISTS)
//  3. Every up migration has a matching _down.sql
//  4. Every down migration drops things in reverse order
//  5. Foreign keys reference tables that exist in earlier migrations
//  6. Migration numbers are unique (no collisions within the ADR set)
//  7. Every ADR migration is tagged with its ADR source comment
//
// Scope: ADR-010 (735) / ADR-011 (720, 732) / ADR-013 (706, 707, 708) /
//        ADR-014 (730, 731) / ADR-015 (755, 756, 757, 758)
// Excluded: ADR-012 (library, no migration) / ADR-016, 017 (test infra)

// adrMigration maps migration file prefix (e.g. "735") to its ADR.
var adrMigrations = []struct {
	num       string // e.g. "735"
	upName    string // e.g. "735_create_alert_breaker_state.sql"
	adr       string // e.g. "ADR-010"
	isAlter   bool   // true if this is an ALTER (no new table)
}{
	{"720", "720_tenants_add_isolation_mode.sql", "ADR-011", true},
	{"730", "730_create_pipeline_artifacts.sql", "ADR-014", false},
	{"731", "731_pipeline_runs_add_artifact_count.sql", "ADR-014", true},
	{"732", "732_create_schema_migrations.sql", "ADR-011", false},
	{"735", "735_create_alert_breaker_state.sql", "ADR-010", false},
	{"706", "706_create_cmdb_ci_types.sql", "ADR-013", false},
	{"707", "707_cmdb_cis_add_type_id.sql", "ADR-013", true},
	{"708", "708_cmdb_ci_types_backfill.sql", "ADR-013", false},
	{"755", "755_create_change_templates.sql", "ADR-015", false},
	{"756", "756_create_change_sops.sql", "ADR-015", false},
	{"757", "757_create_change_sop_steps.sql", "ADR-015", false},
	{"758", "758_tickets_add_change_template.sql", "ADR-015", true},
}

func readMigrationIntegration(t *testing.T, name string) string {
	t.Helper()
	path, err := filepath.Abs("../../migrations/" + name)
	if err != nil {
		t.Fatalf("abs path: %v", err)
	}
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", name, err)
	}
	return string(b)
}

// TestMigration_Adr_AllAtomic asserts every ADR migration wraps in
// BEGIN; / COMMIT; (transaction atomicity).
func TestMigration_Adr_AllAtomic(t *testing.T) {
	for _, m := range adrMigrations {
		body := readMigrationIntegration(t, m.upName)
		if !regexp.MustCompile(`(?im)^BEGIN;`).MatchString(body) {
			t.Errorf("%s (%s) missing BEGIN;", m.upName, m.adr)
		}
		if !regexp.MustCompile(`(?i)COMMIT;`).MatchString(body) {
			t.Errorf("%s (%s) missing COMMIT;", m.upName, m.adr)
		}
	}
}

// TestMigration_Adr_AllIdempotent asserts every CREATE TABLE uses
// IF NOT EXISTS and every ALTER TABLE ADD COLUMN uses IF NOT EXISTS.
func TestMigration_Adr_AllIdempotent(t *testing.T) {
	for _, m := range adrMigrations {
		body := readMigrationIntegration(t, m.upName)
		// Go regexp does not support negative lookahead, so scan every
		// CREATE TABLE occurrence and check the trailing text.
		reCreate := regexp.MustCompile(`(?i)CREATE\s+TABLE\s+`)
		for _, loc := range reCreate.FindAllStringIndex(body, -1) {
			tail := strings.TrimLeft(body[loc[1]:], " \t\r\n")
			if !strings.HasPrefix(tail, "IF NOT EXISTS") {
				t.Errorf("%s (%s): CREATE TABLE without IF NOT EXISTS", m.upName, m.adr)
			}
		}
		reAddCol := regexp.MustCompile(`(?i)ALTER\s+TABLE\s+\S+\s+ADD\s+COLUMN\s+`)
		for _, loc := range reAddCol.FindAllStringIndex(body, -1) {
			tail := strings.TrimLeft(body[loc[1]:], " \t\r\n")
			if !strings.HasPrefix(tail, "IF NOT EXISTS") {
				t.Errorf("%s (%s): ALTER TABLE ADD COLUMN without IF NOT EXISTS", m.upName, m.adr)
			}
		}
	}
}

// TestMigration_Adr_AllHaveDownFiles asserts every ADR up migration has
// a matching _down.sql file with BEGIN;/COMMIT; wrapping.
func TestMigration_Adr_AllHaveDownFiles(t *testing.T) {
	for _, m := range adrMigrations {
		downName := strings.TrimSuffix(m.upName, ".sql") + "_down.sql"
		body := readMigrationIntegration(t, downName)
		if !regexp.MustCompile(`(?im)^BEGIN;`).MatchString(body) {
			t.Errorf("%s missing BEGIN;", downName)
		}
		if !regexp.MustCompile(`(?i)COMMIT;`).MatchString(body) {
			t.Errorf("%s missing COMMIT;", downName)
		}
		// down must drop indexes before dropping tables/columns.
		if isDropOrderCorrect(body) {
			t.Errorf("%s: DROP INDEX/COLUMN ordering should put indexes first", downName)
		}
	}
}

// isDropOrderCorrect reports true if the down migration drops a TABLE or
// COLUMN before an INDEX — which would be a bad order (indexes depend on
// the table/column existing).
func isDropOrderCorrect(body string) bool {
	idxTableOrCol := -1
	idxIndex := -1
	if i := strings.Index(body, "DROP TABLE IF EXISTS"); i != -1 {
		idxTableOrCol = i
	}
	if i := strings.Index(body, "DROP COLUMN IF EXISTS"); i != -1 {
		if idxTableOrCol == -1 || i < idxTableOrCol {
			idxTableOrCol = i
		}
	}
	if i := strings.Index(body, "DROP INDEX IF EXISTS"); i != -1 {
		idxIndex = i
	}
	if idxTableOrCol == -1 || idxIndex == -1 {
		return false
	}
	return idxTableOrCol < idxIndex
}

// TestMigration_Adr_FKReferencesExist asserts every FK reference in the
// ADR migrations points to a table that is created in an earlier
// migration within the ADR set.
func TestMigration_Adr_FKReferencesExist(t *testing.T) {
	// Build the set of tables created by ADR migrations.
	createdTables := map[string]string{} // table → migration num
	for _, m := range adrMigrations {
		body := readMigrationIntegration(t, m.upName)
		re := regexp.MustCompile(`(?i)CREATE\s+TABLE\s+IF\s+NOT EXISTS\s+(\w+)`)
		for _, match := range re.FindAllStringSubmatch(body, -1) {
			createdTables[match[1]] = m.num
		}
	}

	// Scan every up migration for FK references and verify the target
	// table exists in an earlier migration.
	for _, m := range adrMigrations {
		body := readMigrationIntegration(t, m.upName)
		re := regexp.MustCompile(`(?i)REFERENCES\s+(\w+)\(id\)`)
		for _, match := range re.FindAllStringSubmatch(body, -1) {
			target := match[1]
			creator, exists := createdTables[target]
			if !exists {
				// Table might be created outside the ADR set (e.g. tickets).
				// Only fail if the target is in the ADR set with a higher num.
				continue
			}
			if creator >= m.num {
				t.Errorf("%s (%s): FK to %s references table created in %s (must be earlier)",
					m.upName, m.adr, target, creator)
			}
		}
	}
}

// TestMigration_Adr_NumbersUnique asserts no two ADR migrations share the
// same numeric prefix.
func TestMigration_Adr_NumbersUnique(t *testing.T) {
	seen := map[string]string{}
	for _, m := range adrMigrations {
		if prev, exists := seen[m.num]; exists {
			t.Errorf("duplicate ADR migration number %s: %s (%s) and %s (%s)",
				m.num, m.upName, m.adr, prev, "second")
		}
		seen[m.num] = m.upName
	}
}

// TestMigration_Adr_TagsPresent asserts every ADR up migration has a
// source-of-truth comment referencing its ADR.
func TestMigration_Adr_TagsPresent(t *testing.T) {
	for _, m := range adrMigrations {
		body := readMigrationIntegration(t, m.upName)
		if !strings.Contains(body, m.adr) {
			t.Errorf("%s (%s): missing ADR source comment", m.upName, m.adr)
		}
	}
}

// TestMigration_Adr_AllUpsExistOnDisk asserts the migration file for
// every ADR entry actually exists on disk (guards against typos in the
// adrMigrations table).
func TestMigration_Adr_AllUpsExistOnDisk(t *testing.T) {
	dir, err := filepath.Abs("../../migrations")
	if err != nil {
		t.Fatalf("abs path: %v", err)
	}
	for _, m := range adrMigrations {
		if _, err := os.Stat(filepath.Join(dir, m.upName)); err != nil {
			t.Errorf("missing migration file: %s (%s)", m.upName, m.adr)
		}
		downName := strings.TrimSuffix(m.upName, ".sql") + "_down.sql"
		if _, err := os.Stat(filepath.Join(dir, downName)); err != nil {
			t.Errorf("missing down migration file: %s (%s)", downName, m.adr)
		}
	}
}

// TestMigration_Adr_NonADRConflictsInADRRange asserts no non-ADR
// migration occupies one of the 12 ADR-assigned numbers.
func TestMigration_Adr_NonADRConflictsInADRRange(t *testing.T) {
	adrSet := map[string]bool{}
	for _, m := range adrMigrations {
		adrSet[m.num] = true
	}

	dir, err := filepath.Abs("../../migrations")
	if err != nil {
		t.Fatalf("abs path: %v", err)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("readdir: %v", err)
	}

	conflicts := []string{}
	for _, e := range entries {
		if e.IsDir() || strings.HasSuffix(e.Name(), "_down.sql") || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		m := regexp.MustCompile(`^(\d+)_`).FindStringSubmatch(e.Name())
		if m == nil {
			continue
		}
		num := m[1]
		if !adrSet[num] {
			continue
		}
		// This number is in the ADR set. Verify the actual filename matches
		// the expected ADR migration.
		expected, _ := expectedUpName(num)
		if expected != e.Name() {
			conflicts = append(conflicts, e.Name())
		}
	}
	if len(conflicts) > 0 {
		sort.Strings(conflicts)
		t.Errorf("non-ADR migrations occupy ADR numbers: %v", conflicts)
	}

	_ = strconv.Itoa // keep strconv imported for readability of test output
}

func expectedUpName(num string) (string, bool) {
	for _, m := range adrMigrations {
		if m.num == num {
			return m.upName, true
		}
	}
	return "", false
}
