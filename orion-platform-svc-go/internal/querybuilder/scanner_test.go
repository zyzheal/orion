package querybuilder

import (
	"regexp"
	"strings"
	"testing"
)

func TestScanSource_Clean(t *testing.T) {
	src := `
package foo

import "context"

func Clean(ctx context.Context, tenantID string) {
	// All queries go through builder.
	_ = tenantID
	_ = ctx
}
`
	violations := ScanSource(src)
	if len(violations) != 0 {
		t.Errorf("expected 0 violations, got %d: %v", len(violations), violations)
	}
}

func TestScanSource_RawDBQuery(t *testing.T) {
	src := `
package foo

func Bad(db *sql.DB, q string) {
	r.db.Query(q) // raw query bypassing builder
}
`
	violations := ScanSource(src)
	if len(violations) == 0 {
		t.Fatal("expected at least 1 violation")
	}
	found := false
	for _, v := range violations {
		if v.Pattern == "raw-db-query" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected raw-db-query violation, got %v", violations)
	}
}

func TestScanSource_MissingTenantID(t *testing.T) {
	src := `
package foo

var badSQL = "SELECT * FROM users WHERE name = $1 AND status = $2 AND active = $3"
_ = badSQL
`
	violations := ScanSource(src)
	found := false
	for _, v := range violations {
		if v.Pattern == "missing-tenant-id" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected missing-tenant-id violation, got %v", violations)
	}
}

func TestScanSource_HasTenantID(t *testing.T) {
	// SQL with tenant_id should NOT trigger missing-tenant-id.
	src := `
package foo

var goodSQL = "SELECT * FROM users WHERE tenant_id = $1 AND name = $2 AND status = $3 AND active = $4"
_ = goodSQL
`
	violations := ScanSource(src)
	for _, v := range violations {
		if v.Pattern == "missing-tenant-id" {
			t.Errorf("should not have missing-tenant-id violation: %v", v)
		}
	}
}

func TestScanSource_Allowlist_SchemaMigrations(t *testing.T) {
	// schema_migrations is on the default allowlist — no violation.
	src := `
package foo

var q = "SELECT * FROM schema_migrations WHERE version = $1 AND name = $2"
_ = q
`
	violations := ScanSource(src)
	for _, v := range violations {
		if v.Pattern == "missing-tenant-id" && strings.Contains(v.Snippet, "schema_migrations") {
			t.Errorf("schema_migrations should be allowlisted: %v", v)
		}
	}
}

func TestScanSource_Allowlist_Tenants(t *testing.T) {
	src := `
package foo

var q = "SELECT * FROM tenants WHERE id = $1 AND name = $2"
_ = q
`
	violations := ScanSource(src)
	for _, v := range violations {
		if v.Pattern == "missing-tenant-id" && strings.Contains(v.Snippet, "tenants") {
			t.Errorf("tenants should be allowlisted: %v", v)
		}
	}
}

func TestScanSource_Allowlist_ShowStatement(t *testing.T) {
	src := `
package foo

var q = "SHOW search_path"
_ = q
`
	violations := ScanSource(src)
	for _, v := range violations {
		if v.Pattern == "missing-tenant-id" && strings.Contains(v.Snippet, "SHOW") {
			t.Errorf("SHOW should be allowlisted: %v", v)
		}
	}
}

func TestScanSource_Empty(t *testing.T) {
	if violations := ScanSource(""); len(violations) != 0 {
		t.Errorf("expected 0 violations for empty src, got %d", len(violations))
	}
}

func TestScanSource_CommentsSkipped(t *testing.T) {
	// Comments mentioning r.db.Query should not be flagged.
	src := `
package foo

// This comment mentions r.db.Query but is not real code.
// var q = "SELECT * FROM users WHERE name = $1 AND status = $2"

func Clean() {}
`
	violations := ScanSource(src)
	if len(violations) != 0 {
		t.Errorf("comments should be skipped, got %v", violations)
	}
}

func TestScanSource_LineNumbers(t *testing.T) {
	// Line 5 should be flagged.
	src := `
package foo

func Bad(db *sql.DB, q string) {
	_ = db
	r.db.Query(q) // line 6
}
`
	violations := ScanSource(src)
	found := false
	for _, v := range violations {
		if v.Pattern == "raw-db-query" && v.Line >= 5 {
			found = true
			break
	}
	}
	if !found {
		t.Errorf("expected raw-db-query at line >= 5, got %v", violations)
	}
}

func TestScanSource_WithAllowlist(t *testing.T) {
	src := `
package foo

var q1 = "SELECT * FROM my_custom_table WHERE x = $1 AND y = $2"
var q2 = "SELECT * FROM users WHERE tenant_id = $1"
`
	// Add my_custom_table to the allowlist.
	allowlist := Allowlist{regexp.MustCompile(`my_custom_table`)}
	violations := ScanSourceWithAllowlist(src, allowlist)
	// q1 should be skipped; q2 is fine (has tenant_id).
	for _, v := range violations {
		if strings.Contains(v.Snippet, "my_custom_table") {
			t.Errorf("my_custom_table should be allowlisted: %v", v)
		}
	}
}

func TestScanSource_DefaultAllowlist_InformationSchema(t *testing.T) {
	src := `
package foo

var q = "SELECT * FROM information_schema.tables WHERE table_name = $1"
_ = q
`
	violations := ScanSource(src)
	for _, v := range violations {
		if strings.Contains(v.Snippet, "information_schema") && v.Pattern == "missing-tenant-id" {
			t.Errorf("information_schema should be allowlisted: %v", v)
		}
	}
}

func TestScanSource_PgxCode_23505(t *testing.T) {
	// Test that code with SQLSTATE codes (23505) doesn't trigger false positives.
	src := `
package foo

// Handle unique constraint violations (SQLSTATE 23505).
func Handle(err error) {
	if err != nil {
		_ = err
	}
}
`
	violations := ScanSource(src)
	for _, v := range violations {
		if strings.Contains(v.Snippet, "23505") {
			t.Errorf("23505 shouldn't be flagged: %v", v)
		}
	}
}
