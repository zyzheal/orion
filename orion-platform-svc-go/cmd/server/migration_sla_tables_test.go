package main

import (
	"os"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// Round 51: every statement in internal/sla/repository addressed sla_tracking
// (singular) while 070 creates and 570/571/572 own sla_trackings (plural), and
// CreateDefinition inserted into a definition_type column that no migration
// ever added. Both were invisible to the SQL tests because they only checked
// that a statement ran, not that it named an existing relation or column. These
// tests read the repository source and the migration SQL and compare the
// identifiers, so the two sides can never drift apart again without a failure.

func slaRepositorySQL() string {
	b, err := os.ReadFile("../../internal/sla/repository/repository.go")
	if err != nil {
		return ""
	}
	return string(b)
}

// An sla_* identifier is only a relation when it sits in a statement position.
// sla_definition_id is a column on sla_trackings and a bare word scan reported
// it as a missing relation.
var reSLARelationPos = regexp.MustCompile(`(?is)\b(?:FROM|INTO|UPDATE|TABLE)\s+(sla_[a-z_]+)\b`)

// All sla_* relations the repository addresses.
func slaRelationsNamedByRepository() []string {
	out := []string{}
	for _, m := range reSLARelationPos.FindAllStringSubmatch(slaRepositorySQL(), -1) {
		if !containsStr(out, m[1]) {
			out = append(out, m[1])
		}
	}
	sort.Strings(out)
	return out
}

var reCreateTable = regexp.MustCompile(`(?is)CREATE TABLE (?:IF NOT EXISTS )?([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\);`)

// parseCreateTables returns, for every CREATE TABLE in the body, the set of
// column names it declares. Lines that are table-level constraints rather than
// column declarations are skipped.
func parseCreateTables(body string) map[string]map[string]bool {
	out := map[string]map[string]bool{}
	for _, m := range reCreateTable.FindAllStringSubmatch(body, -1) {
		cols := map[string]bool{}
		for _, line := range strings.Split(m[2], "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "--") {
				continue
			}
			fields := strings.Fields(line)
			if len(fields) == 0 {
				continue
			}
			switch strings.ToUpper(fields[0]) {
			case "PRIMARY", "UNIQUE", "CONSTRAINT", "FOREIGN", "CHECK", "INDEX":
				continue
			}
			cols[strings.ToLower(fields[0])] = true
		}
		out[strings.ToLower(m[1])] = cols
	}
	return out
}

// slaSchema merges the CREATE TABLE bodies of every top-level migration with the
// columns later migrations add, so a column introduced by 571 counts as declared.
func slaSchema(t *testing.T) map[string]map[string]bool {
	t.Helper()
	files := entriesInMigrationsDir()
	if len(files) == 0 {
		t.Fatal("no migrations found")
	}
	schema := map[string]map[string]bool{}
	for _, f := range files {
		for table, cols := range parseCreateTables(f.body) {
			if !strings.HasPrefix(table, "sla_") {
				continue
			}
			if _, ok := schema[table]; !ok {
				schema[table] = map[string]bool{}
			}
			for c := range cols {
				schema[table][c] = true
			}
		}
	}
	reAddCol := regexp.MustCompile(`(?is)ALTER TABLE ([a-z_][a-z0-9_]*) ADD COLUMN ([a-z_][a-z0-9_]*)`)
	for _, f := range files {
		for _, m := range reAddCol.FindAllStringSubmatch(f.body, -1) {
			table, col := strings.ToLower(m[1]), strings.ToLower(m[2])
			if !strings.HasPrefix(table, "sla_") {
				continue
			}
			if _, ok := schema[table]; !ok {
				schema[table] = map[string]bool{}
			}
			schema[table][col] = true
		}
	}
	return schema
}

// TestMigration_SLA_RelationsNamedByTheRepositoryAreCreated fails on a relation
// the repository addresses that no top-level migration creates. That is the
// singular sla_tracking defect: nothing ever created it, so all nine tracking
// routes plus /sla/detect and /sla/stats failed at the SQL layer.
func TestMigration_SLA_RelationsNamedByTheRepositoryAreCreated(t *testing.T) {
	schema := slaSchema(t)
	relations := slaRelationsNamedByRepository()
	if len(relations) == 0 {
		t.Fatal("detector found no sla_* relation in the repository source")
	}
	for _, rel := range relations {
		if _, ok := schema[rel]; !ok {
			t.Errorf("the repository addresses %s but no top-level migration creates it", rel)
		}
	}
	// positive control: the singular name must be reported as missing, which is
	// what the detector returned before the fix.
	if _, ok := schema["sla_tracking"]; ok {
		t.Fatal("sla_tracking is not a relation any migration creates")
	}
}

// TestMigration_SLA_InsertColumnsExistInTheDDL parses the column list of each
// INSERT and UPDATE statement and checks every column against the DDL. This is
// the detector that would have caught the definition_type column: 070 declares
// `type` and builds idx_sla_definitions_type on it, and no migration adds
// definition_type.
func TestMigration_SLA_InsertColumnsExistInTheDDL(t *testing.T) {
	schema := slaSchema(t)
	src := slaRepositorySQL()
	reInsert := regexp.MustCompile(`(?is)INSERT INTO (sla_[a-z_]+) \(([^)]*)\)`)
	reUpdate := regexp.MustCompile(`(?is)UPDATE (sla_[a-z_]+) SET ([^W]+?)WHERE`)

	checked := 0
	for _, m := range reInsert.FindAllStringSubmatch(src, -1) {
		table := strings.ToLower(m[1])
		for _, col := range strings.Split(m[2], ",") {
			col = strings.TrimSpace(col)
			if col == "" {
				continue
			}
			checked++
			if cols, ok := schema[table]; ok {
				if !cols[strings.ToLower(col)] {
					t.Errorf("%s has no column %s; no migration adds it", table, col)
				}
			} else {
				t.Errorf("%s is not created by any migration", table)
			}
		}
	}
	for _, m := range reUpdate.FindAllStringSubmatch(src, -1) {
		table := strings.ToLower(m[1])
		clause := m[2]
		for _, part := range strings.Split(clause, ",") {
			parts := strings.SplitN(part, "=", 2)
			if len(parts) != 2 {
				continue
			}
			col := strings.TrimSpace(parts[0])
			if !reSLAIdentifier.MatchString(col) {
				continue
			}
			checked++
			if cols, ok := schema[table]; ok {
				if !cols[strings.ToLower(col)] {
					t.Errorf("%s has no column %s; no migration adds it", table, col)
				}
			} else {
				t.Errorf("%s is not created by any migration", table)
			}
		}
	}
	if checked == 0 {
		t.Fatal("detector parsed no column from any statement")
	}
	t.Logf("checked %d insert/update columns against the migration DDL", checked)

	// positive control: the pre-fix column must be reported missing.
	if schema["sla_definitions"]["definition_type"] {
		t.Fatal("detector accepted a column no migration adds")
	}
	if !schema["sla_definitions"]["type"] {
		t.Fatal("070 declares type on sla_definitions")
	}
}

var reSLAIdentifier = regexp.MustCompile(`^[a-z_][a-z0-9_]*$`)

// TestMigration_SLA_TrackingRelationIsPlural pins the relation name in the SQL
// itself: the CREATE TABLE that owns it must be the plural one, and no
// migration may create the singular name.
func TestMigration_SLA_TrackingRelationIsPlural(t *testing.T) {
	creators := []string{}
	singular := []string{}
	for _, f := range entriesInMigrationsDir() {
		if _, ok := parseCreateTables(f.body)["sla_trackings"]; ok {
			creators = append(creators, f.name)
		}
		if single := singularTracking(f.body); len(single) > 0 {
			singular = append(singular, f.name+":"+single[0])
		}
	}
	if len(creators) != 1 || creators[0] != "070_create_sla_tables.sql" {
		t.Fatalf("sla_trackings must be created by exactly 070, got %v", creators)
	}
	if len(singular) > 0 {
		t.Errorf("migration(s) name the singular relation: %v", singular)
	}
	// positive controls: the detector must see the singular spelling and must not
	// see it inside the plural one.
	if got := singularTracking("CREATE TABLE sla_tracking (id UUID);"); len(got) != 1 {
		t.Fatalf("detector missed the singular relation, got %v", got)
	}
	if got := singularTracking("CREATE TABLE sla_trackings (id UUID);"); len(got) != 0 {
		t.Fatalf("detector matched the plural relation, got %v", got)
	}
}

var (
	reTrackingWord   = regexp.MustCompile(`\bsla_tracking\b`)
	reTrackingPlural = regexp.MustCompile(`\bsla_trackings\b`)
)

// singularTracking masks out the plural relation first, because the singular
// pattern is a prefix of it and Go's regexp has no lookahead.
func singularTracking(body string) []string {
	return reTrackingWord.FindAllString(reTrackingPlural.ReplaceAllString(body, "PLURAL"), -1)
}

// TestMigration_SLA_DownReversesUp checks that 070's rollback drops every
// relation and index its forward migration creates. The generator omitted
// DROP TABLE for sla_definitions and left its four indexes dangling behind.
func TestMigration_SLA_DownReversesUp(t *testing.T) {
	up := migrationBody(t, "070_create_sla_tables.sql")
	down := migrationBody(t, "070_create_sla_tables_down.sql")

	tabs := parseCreateTables(up)
	if len(tabs) != 3 {
		t.Fatalf("070 creates %d tables, expected 3", len(tabs))
	}
	for table := range tabs {
		if !strings.Contains(down, "DROP TABLE IF EXISTS \""+table+"\"") {
			t.Errorf("the 070 rollback does not drop %s", table)
		}
	}

	reIndex := regexp.MustCompile(`(?i)CREATE INDEX IF NOT EXISTS ([a-z_][a-z0-9_]*) ON (sla_[a-z_]+)`)
	indexes := map[string][]string{}
	for _, m := range reIndex.FindAllStringSubmatch(up, -1) {
		indexes[m[1]] = append(indexes[m[1]], m[2])
	}
	for _, on := range sortedKeys(indexes) {
		t.Logf("indexes on %s: %v", on, indexes[on])
	}
	names := sortedKeys(indexes)
	dropped := 0
	for _, name := range names {
		dropped++
		if !strings.Contains(down, "DROP INDEX IF EXISTS \""+name+"\"") {
			t.Errorf("the 070 rollback does not drop index %s", name)
		}
	}
	if dropped != 11 {
		t.Fatalf("expected 11 indexes to drop, counted %d", dropped)
	}
}
