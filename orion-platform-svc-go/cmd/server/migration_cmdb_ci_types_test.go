package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// ADR-013 (docs/adr/ADR-013-CMDB-二阶模型决策.md §3.2.1) specifies a
// 3-migration progressive scheme: 706 creates cmdb_ci_types, 707 adds the
// nullable type_id FK on cmdb_cis, 708 backfills types from ci_type strings.
//
// (The ADR-013 draft originally proposed numbers 700/701/702, but those are
// already taken by unrelated migrations — backfill_user_role_from_capability,
// add_recipients_to_escalation_policy, and create_oncall_handoff. Renumbered
// to 706/707/708 to preserve migration-order guarantees.)
//
// These tests pin the migration contract by parsing the actual SQL:
//
//   - 706 CREATE TABLE cmdb_ci_types has all required columns (id/tenant_id/
//     name/description/attributes/created_at/updated_at) and the
//     UNIQUE (tenant_id, name) constraint. Both GIN and b-tree indexes are
//     declared.
//   - 707 ALTER TABLE cmdb_cis adds a nullable type_id FK referencing
//     cmdb_ci_types(id), and creates two indexes.
//   - 708 backfill is idempotent (ON CONFLICT DO NOTHING + WHERE type_id IS
//     NULL) and tenant-scoped.
//   - Each down reverses its up without destroying user edits.
//
// Any regression in the migration body shows up here before it reaches prod.

func readMigration(t *testing.T, name string) string {
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

func mustMatch(t *testing.T, pattern, body, what string) {
	t.Helper()
	if !regexp.MustCompile(pattern).MatchString(body) {
		t.Errorf("%s: pattern did not match: %s", what, pattern)
	}
}

func mustNotMatch(t *testing.T, pattern, body, what string) {
	t.Helper()
	if regexp.MustCompile(pattern).MatchString(body) {
		t.Errorf("%s: pattern unexpectedly matched: %s", what, pattern)
	}
}

func TestMigration706_CreatesCmdbcITypesTable(t *testing.T) {
	body := readMigration(t, "706_create_cmdb_ci_types.sql")

	// Extract the CREATE TABLE cmdb_ci_types body.
	re := regexp.MustCompile(`(?is)CREATE TABLE IF NOT EXISTS cmdb_ci_types\s*\(([\s\S]*?)\);`)
	m := re.FindStringSubmatch(body)
	if m == nil {
		t.Fatal("706 does not CREATE TABLE cmdb_ci_types")
	}
	bodyDef := m[1]

	// Columns required by ADR-013 §3.2.1. Missing any of these means the
	// Service layer's CITypeRepository contract cannot be served.
	for _, col := range []string{
		"id",
		"tenant_id",
		"name",
		"description",
		"attributes",
		"created_at",
		"updated_at",
	} {
		if !regexp.MustCompile(`(?im)^\s*`+regexp.QuoteMeta(col)+`\s+\w+`).MatchString(bodyDef) {
			t.Errorf("cmdb_ci_types missing column %q", col)
		}
	}

	// Column-type invariants.
	invariants := []struct {
		name    string
		pattern string
	}{
		{"id UUID PK", `(?i)\bid\s+UUID\s+PRIMARY KEY`},
		{"tenant_id TEXT NOT NULL", `(?i)\btenant_id\s+TEXT\s+NOT NULL`},
		{"name TEXT NOT NULL", `(?i)\bname\s+TEXT\s+NOT NULL`},
		// attributes JSONB with default '[]' or "[]"
		{"attributes JSONB NOT NULL DEFAULT '[]'", `(?i)\battributes\s+JSONB\s+NOT NULL\s+DEFAULT\s+'?\[\]'?`},
	}
	for _, tc := range invariants {
		mustMatch(t, tc.pattern, bodyDef, "706 "+tc.name)
	}

	// Table-level UNIQUE (tenant_id, name) — ADR §3.2.1 explicit.
	mustMatch(t, `(?i)UNIQUE\s*\(tenant_id,\s*name\)`, bodyDef, "706 UNIQUE(tenant_id,name)")

	// Required indexes (declared as CREATE INDEX IF NOT EXISTS, idempotent).
	for _, idx := range []string{
		"idx_cmdb_ci_types_tenant",
		"idx_cmdb_ci_types_attributes_gin",
	} {
		if !strings.Contains(body, idx) {
			t.Errorf("706 missing index %s", idx)
		}
	}
	mustMatch(t, `(?is)CREATE INDEX IF NOT EXISTS\s+idx_cmdb_ci_types_tenant\s+ON\s+cmdb_ci_types\s*\(tenant_id\)`, body, "706 tenant index")
	mustMatch(t, `(?is)USING\s+GIN\s*\(attributes\)`, body, "706 GIN index on attributes")

	// Must be wrapped in BEGIN/COMMIT for atomicity.
	mustMatch(t, `(?im)^BEGIN;`, body, "706 BEGIN")
	mustMatch(t, `(?is)COMMIT;`, body, "706 COMMIT")
}

func TestMigration707_AddsTypeIdFKToCmdbCIs(t *testing.T) {
	body := readMigration(t, "707_cmdb_cis_add_type_id.sql")

	// ALTER TABLE cmdb_cis ADD COLUMN IF NOT EXISTS type_id UUID
	mustMatch(t,
		`(?is)ALTER TABLE\s+cmdb_cis\s+ADD COLUMN IF NOT EXISTS\s+type_id\s+UUID`,
		body, "707 ALTER TABLE ADD COLUMN type_id")

	// FK must reference cmdb_ci_types.id with ON DELETE SET NULL so dropping a
	// type does not fail on existing CIs.
	mustMatch(t,
		`(?is)REFERENCES\s+cmdb_ci_types\s*\(\s*id\s*\)\s+ON DELETE SET NULL`,
		body, "707 FK references cmdb_ci_types(id) ON DELETE SET NULL")

	// Idempotency-safe index creation.
	for _, idx := range []string{
		"idx_cmdb_cis_type_id",
		"idx_cmdb_cis_tenant_type_id",
	} {
		if !strings.Contains(body, idx) {
			t.Errorf("707 missing index %s", idx)
		}
	}
	mustMatch(t,
		`(?is)CREATE INDEX IF NOT EXISTS\s+idx_cmdb_cis_type_id\s+ON\s+cmdb_cis\s*\(type_id\)`,
		body, "707 type_id index")
	mustMatch(t,
		`(?is)CREATE INDEX IF NOT EXISTS\s+idx_cmdb_cis_tenant_type_id\s+ON\s+cmdb_cis\s*\(tenant_id,\s*type_id\)`,
		body, "707 tenant_type_id index")

	// Atomic.
	mustMatch(t, `(?im)^BEGIN;`, body, "707 BEGIN")
	mustMatch(t, `(?is)COMMIT;`, body, "707 COMMIT")
}

func TestMigration708_BackfillIsIdempotent(t *testing.T) {
	body := readMigration(t, "708_cmdb_ci_types_backfill.sql")

	// Step 1: INSERT INTO cmdb_ci_types ... ON CONFLICT (tenant_id, name) DO
	// NOTHING — required for idempotent re-runs on DBs that already have types.
	mustMatch(t,
		`(?is)INSERT\s+INTO\s+cmdb_ci_types\s*\([\s\S]*?\)\s+SELECT\s+DISTINCT[\s\S]*?ON\s+CONFLICT\s*\(tenant_id,\s*name\)\s+DO\s+NOTHING`,
		body, "708 backfill INSERT with ON CONFLICT DO NOTHING")

	// Step 2: UPDATE cmdb_cis SET type_id = t.id WHERE c.type_id IS NULL —
	// required so a re-run does not overwrite user-assigned type_ids.
	mustMatch(t,
		`(?is)UPDATE\s+cmdb_cis\s+c\s+SET\s+type_id\s*=\s*t\.id[\s\S]*?WHERE[\s\S]*?c\.type_id\s+IS\s+NULL`,
		body, "708 backfill UPDATE with WHERE type_id IS NULL")

	// UPDATE must filter by tenant_id to prevent cross-tenant type_id leaking.
	mustMatch(t,
		`(?is)c\.tenant_id::?TEXT\s*=\s*t\.tenant_id`,
		body, "708 backfill UPDATE tenant_id filter")

	// CI rows with NULL/empty ci_type must not be backfilled (otherwise we
	// create spurious types named NULL/'').
	mustMatch(t,
		`(?is)WHERE\s+ci_type\s+IS\s+NOT\s+NULL[\s\S]*?ci_type\s*<>\s*''`,
		body, "708 backfill WHERE filters null/empty ci_type")

	// Atomic.
	mustMatch(t, `(?im)^BEGIN;`, body, "708 BEGIN")
	mustMatch(t, `(?is)COMMIT;`, body, "708 COMMIT")
}

func TestMigration706_Down_ReversesUp(t *testing.T) {
	d706 := readMigration(t, "706_create_cmdb_ci_types_down.sql")
	// Order: drop indexes first, then the table (reverse of up).
	mustMatch(t, `(?is)DROP\s+INDEX\s+IF\s+EXISTS\s+idx_cmdb_ci_types_attributes_gin`, d706, "706 down drops GIN index")
	mustMatch(t, `(?is)DROP\s+INDEX\s+IF\s+EXISTS\s+idx_cmdb_ci_types_tenant`, d706, "706 down drops tenant index")
	mustMatch(t, `(?is)DROP\s+TABLE\s+IF\s+EXISTS\s+cmdb_ci_types`, d706, "706 down drops table")
	mustMatch(t, `(?im)^BEGIN;`, d706, "706 down BEGIN")
	mustMatch(t, `(?is)COMMIT;`, d706, "706 down COMMIT")
}

func TestMigration707_Down_ReversesUp(t *testing.T) {
	d707 := readMigration(t, "707_cmdb_cis_add_type_id_down.sql")
	mustMatch(t, `(?is)DROP\s+INDEX\s+IF\s+EXISTS\s+idx_cmdb_cis_tenant_type_id`, d707, "707 down drops tenant_type_id index")
	mustMatch(t, `(?is)DROP\s+INDEX\s+IF\s+EXISTS\s+idx_cmdb_cis_type_id`, d707, "707 down drops type_id index")
	// PostgreSQL DROP COLUMN uses "IF EXISTS", not "IF NOT EXISTS".
	mustMatch(t, `(?is)ALTER TABLE\s+cmdb_cis\s+DROP\s+COLUMN\s+IF\s+EXISTS\s+type_id`, d707, "707 down drops type_id column")
	mustMatch(t, `(?im)^BEGIN;`, d707, "707 down BEGIN")
	mustMatch(t, `(?is)COMMIT;`, d707, "707 down COMMIT")
}

func TestMigration708_Down_PreservesUserEdits(t *testing.T) {
	d708 := readMigration(t, "708_cmdb_ci_types_backfill_down.sql")
	// The down only NULLs type_id — it does NOT delete cmdb_ci_types rows,
	// because users may have edited/extended them post-backfill.
	mustMatch(t, `(?is)UPDATE\s+cmdb_cis\s+SET\s+type_id\s*=\s*NULL`, d708, "708 down NULLs type_id")
	mustNotMatch(t, `(?i)DROP\s+TABLE\s+cmdb_ci_types`, d708, "708 down must NOT drop cmdb_ci_types (preserves user edits)")
	mustNotMatch(t, `(?i)DELETE\s+FROM\s+cmdb_ci_types`, d708, "708 down must NOT delete cmdb_ci_types rows")
	mustMatch(t, `(?im)^BEGIN;`, d708, "708 down BEGIN")
	mustMatch(t, `(?is)COMMIT;`, d708, "708 down COMMIT")
}

func TestMigration706707708_FileNamesAreContiguous(t *testing.T) {
	// All six files must exist as siblings in the migrations directory. If any
	// is renamed or deleted, that's a regression.
	files := []string{
		"706_create_cmdb_ci_types.sql",
		"706_create_cmdb_ci_types_down.sql",
		"707_cmdb_cis_add_type_id.sql",
		"707_cmdb_cis_add_type_id_down.sql",
		"708_cmdb_ci_types_backfill.sql",
		"708_cmdb_ci_types_backfill_down.sql",
	}
	for _, f := range files {
		if _, err := os.Stat(filepath.Join("../../migrations", f)); err != nil {
			t.Errorf("migration file missing: %s (%v)", f, err)
		}
	}
}
