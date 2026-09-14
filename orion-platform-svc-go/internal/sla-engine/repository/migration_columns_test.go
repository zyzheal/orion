package repository

import (
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"testing"

	slamodels "orion/platform-svc-go/internal/sla-engine/models"
	storagemodels "orion/platform-svc-go/internal/storage/models"
	vulnmodels "orion/platform-svc-go/internal/vulnerability/models"
)

// The six relations of migration 584 did not exist until R37. sla_profiles,
// sla_trackers, sla_holidays and sla_violations lived only under
// internal/sla-engine/migrations/, a subdirectory database.LoadMigrations
// never opens, and storage_entries and vulnerabilities were created nowhere.
// Every endpoint of those three modules failed with
// 'pq: relation ... does not exist' before any business logic could run.
//
// The checks below keep the DDL and the repository column names together: a
// column added to one INSERT list without a matching DDL column breaks here
// instead of at the first request.

// migrationColumns parses the CREATE TABLE blocks of one migration file into a
// table -> column set. Only that file matters: all six relations are new in it
// and no earlier migration ALTERs them.
func migrationColumns(t *testing.T, file string) map[string]map[string]bool {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("..", "..", "..", "migrations", file))
	if err != nil {
		t.Fatalf("read migrations/%s: %v", file, err)
	}

	reCreate := regexp.MustCompile(`(?i)^\s*CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-z_][a-z0-9_]*)`)
	reCol := regexp.MustCompile(`(?i)^\s*([a-z_][a-z0-9_]*)\s+[a-z(]`)
	skip := map[string]bool{
		"constraint": true, "primary": true, "foreign": true, "unique": true,
		"check": true, "references": true, "default": true, "not": true,
		"null": true, "index": true, "create": true, "alter": true, "drop": true,
	}

	defined := map[string]map[string]bool{}
	cur := ""
	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if m := reCreate.FindStringSubmatch(line); m != nil {
			cur = strings.ToLower(m[1])
			if defined[cur] == nil {
				defined[cur] = map[string]bool{}
			}
			continue
		}
		if cur == "" || strings.HasPrefix(line, ")") {
			cur = ""
			continue
		}
		if m := reCol.FindStringSubmatch(line); m != nil {
			name := strings.ToLower(m[1])
			if !skip[name] {
				defined[cur][name] = true
			}
		}
	}
	return defined
}

// dbTagColumns is the column set a model actually addresses: sqlx writes and
// scans exactly these names, so they are the repository's view of the schema.
func dbTagColumns(v any) map[string]bool {
	t := reflect.TypeOf(v)
	if t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	cols := map[string]bool{}
	for i := 0; i < t.NumField(); i++ {
		tag := t.Field(i).Tag.Get("db")
		if tag == "" {
			continue
		}
		if idx := strings.Index(tag, " "); idx >= 0 {
			tag = tag[:idx]
		}
		cols[strings.ToLower(tag)] = true
	}
	return cols
}

func TestMigration584_DefinesEveryColumnTheModelsDeclare(t *testing.T) {
	const file = "584_create_sla_storage_vulnerability_tables.sql"
	defined := migrationColumns(t, file)

	cases := []struct {
		table string
		model any
	}{
		{"sla_profiles", slamodels.SLAProfile{}},
		{"sla_trackers", slamodels.SLATracker{}},
		{"sla_holidays", slamodels.SLAHoliday{}},
		{"sla_violations", slamodels.SLAViolation{}},
		{"storage_entries", storagemodels.StorageEntry{}},
		{"vulnerabilities", vulnmodels.Vulnerability{}},
	}
	for _, tc := range cases {
		if defined[tc.table] == nil {
			t.Errorf("%s is not created by %s", tc.table, file)
			continue
		}
		for col := range dbTagColumns(tc.model) {
			if !defined[tc.table][col] {
				t.Errorf("%s declares db column %q that %s does not create", tc.table, col, file)
			}
		}
	}
}
