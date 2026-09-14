package repository

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/permission/models"
)

// --- source-level guards ---

const sourceFile = "repository.go"

func stripComments(src string) string {
	var out strings.Builder
	for i := 0; i < len(src); {
		if i+1 < len(src) && src[i] == '/' && src[i+1] == '/' {
			for i < len(src) && src[i] != '\n' {
				i++
			}
			continue
		}
		out.WriteByte(src[i])
		i++
	}
	return out.String()
}

// TestPermissionIsNotWildcarded guards the old SELECT * in GetByID and List.
//
// go-common opens the pool with sqlx.Open and never calls Unsafe, so sqlx scans
// in safe mode and a wildcard select dies on the first row the moment a
// migration adds a column the model does not map --
// "missing destination name <col>". That error is not sql.ErrNoRows, so it
// walks repository -> service -> handler and the endpoint answers 500 instead
// of data. Migration 571 adds deleted_at and migration 572 adds created_by and
// updated_by to permissions, so both permission reads were 500s: the
// access-control table was unreadable.
func TestPermissionIsNotWildcarded(t *testing.T) {
	src, err := os.ReadFile(sourceFile)
	if err != nil {
		t.Fatalf("read %s: %v", sourceFile, err)
	}
	body := stripComments(string(src))
	if strings.Contains(body, "SELECT * FROM permissions") {
		t.Error("permissions is still selected with * instead of a named column list")
	}
}

// TestColumnConstantsMatchThePinnedExpectation writes the contract down twice:
// once in production code and once in this test, so a mutation that empties
// permissionColumns cannot make the pinned expectation follow it.
const wantColumns = "id, name, code, resource, action, \"desc\", tenant_id, user_id, created_at, updated_at"

func TestColumnConstantsMatchThePinnedExpectation(t *testing.T) {
	if permissionColumns != wantColumns {
		t.Errorf("permissionColumns drifted from the pinned expectation\n  got:      %s\n  expected: %s", permissionColumns, wantColumns)
	}
	if strings.Contains(permissionColumns, "*") {
		t.Error("permissionColumns must name every column; a wildcard is a 500 in safe mode")
	}
	if !strings.Contains(permissionColumns, "\"desc\"") {
		t.Error("desc must stay quoted: it is a PostgreSQL keyword")
	}
}

// permissionColumnsExistInMigration proves the select list is real schema.
var permissionModelColumns = []string{
	"id", "name", "code", "resource", "action", "desc", "tenant_id",
	"user_id", "created_at", "updated_at",
}

func TestPermissionColumnsExistInMigration(t *testing.T) {
	path, err := filepath.Abs("../../../migrations/058_create_permission_tables.sql")
	if err != nil {
		t.Fatal(err)
	}
	src, err := os.ReadFile(path)
	if err != nil {
		t.Skipf("migration not present: %v", err)
	}
	text := string(src)
	for _, col := range permissionModelColumns {
		if !strings.Contains(text, col) {
			t.Errorf("migration %s does not define %s, but models.Permission maps it", filepath.Base(path), col)
		}
	}
}

// --- behaviour: the named column list is what reaches the driver ---

func norm(s string) string {
	return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(s, " "))
}

// newMock matches expected SQL on exact whitespace-normalised text.
//
// go-sqlmock's default QueryMatcherRegexp treats a $ in the expected text as an
// end-of-string anchor, so an expectation containing $1 could never match and a
// test would pass vacuously. Every expectation below pins placeholder numbers,
// so exact matching is required for the tests to mean anything.
func newMock(t *testing.T) (*Repository, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		if norm(expected) == norm(actual) {
			return nil
		}
		return fmt.Errorf("sql mismatch:\n  expected: %s\n     actual: %s", norm(expected), norm(actual))
	})))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return NewRepository(sqlx.NewDb(raw, "postgres")), mock
}

func permColumns() []string { return permissionModelColumns }

func TestGetByIDSelectsTheMappedColumnsOnly(t *testing.T) {
	r, mock := newMock(t)
	now := time.Now().UTC()

	mock.ExpectQuery("SELECT "+wantColumns+" FROM permissions WHERE id=$1 AND tenant_id=$2").
		WithArgs("perm-1", "tenant-alpha").
		WillReturnRows(sqlmock.NewRows(permColumns()).AddRow(
			"perm-1", "Deploy", "deploy:create", "pipeline", "create",
			"create a pipeline", "tenant-alpha", "user-1", now, now))

	p, err := r.GetByID(context.Background(), "tenant-alpha", "perm-1")
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if p.Code != "deploy:create" || p.TenantID != "tenant-alpha" {
		t.Errorf("unexpected row: %+v", p)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestGetByIDMissingPermissionReportsNotFound(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT "+wantColumns+" FROM permissions WHERE id=$1 AND tenant_id=$2").
		WithArgs("missing", "tenant-alpha").
		WillReturnRows(sqlmock.NewRows(permColumns()))

	_, err := r.GetByID(context.Background(), "tenant-alpha", "missing")
	if !errors.Is(err, errNotFound) {
		t.Fatalf("want errNotFound, got %v", err)
	}
}

func TestListBindsTenantAndFilters(t *testing.T) {
	r, mock := newMock(t)
	now := time.Now().UTC()

	mock.ExpectQuery("SELECT "+wantColumns+" FROM permissions WHERE tenant_id=$1 AND resource=$2 AND action=$3 ORDER BY created_at DESC OFFSET $4 LIMIT $5").
		WithArgs("tenant-alpha", "pipeline", "create", 0, 20).
		WillReturnRows(sqlmock.NewRows(permColumns()).AddRow(
			"perm-1", "Deploy", "deploy:create", "pipeline", "create",
			"create a pipeline", "tenant-alpha", "user-1", now, now))

	items, err := r.List(context.Background(), "tenant-alpha", &models.ListFilter{
		Resource: stringPtr("pipeline"), Action: stringPtr("create"),
	}, 0, 20)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("len=%d, want 1", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCountBoundsTenant(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery("SELECT COUNT(*) FROM permissions WHERE tenant_id=$1").
		WithArgs("tenant-alpha").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(7))

	n, err := r.Count(context.Background(), "tenant-alpha")
	if err != nil {
		t.Fatalf("Count: %v", err)
	}
	if n != 7 {
		t.Fatalf("n=%d, want 7", n)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestUpdateRendersDistinctPlaceholders proves the dynamic SET clause does not
// reuse a placeholder number. The failure mode is silent: WHERE id=$1 resolves
// to the first SET value, so the statement matches nothing and the caller gets
// a nil error for an update that never happened.
func TestUpdateRendersDistinctPlaceholders(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectExec(`UPDATE permissions SET name=$1, code=$2, resource=$3, action=$4, "desc"=$5, updated_at=NOW() WHERE id=$6 AND tenant_id=$7`).
		WithArgs("Deploy", "deploy:create", "pipeline", "create", "create a pipeline", "perm-1", "tenant-alpha").
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := r.Update(context.Background(), &models.Permission{
		ID: "perm-1", TenantID: "tenant-alpha", Name: "Deploy", Code: "deploy:create",
		Resource: "pipeline", Action: "create", Desc: "create a pipeline",
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestDeleteBoundsTenant(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectExec(`DELETE FROM permissions WHERE id=$1 AND tenant_id=$2`).
		WithArgs("perm-1", "tenant-alpha").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.Delete(context.Background(), "tenant-alpha", "perm-1"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// TestDescIsAlwaysQuoted proves the reserved word is never emitted bare.
//
// desc is a hard reserved word, proven against a live PostgreSQL 16:
// INSERT INTO perm_probe (id, desc, tenant_id) VALUES (...) and
// UPDATE perm_probe SET desc='x' both answer "syntax error at or near "desc"",
// while the same statements with "desc" parse. So Create and every Update that
// carried a description were 500s -- writes into the access-control table did
// not happen at all.
func TestDescIsAlwaysQuoted(t *testing.T) {
	src, err := os.ReadFile(sourceFile)
	if err != nil {
		t.Fatalf("read %s: %v", sourceFile, err)
	}
	// stripComments drops // commentary so the prose above this test cannot
	// satisfy the check; \" is folded to a bare quote so the check looks at
	// the emitted SQL spelling rather than at Go escaping.
	body := strings.ReplaceAll(stripComments(string(src)), `\"`, `"`)
	matches := regexp.MustCompile("desc").FindAllStringIndex(body, -1)
	if len(matches) == 0 {
		t.Fatal("desc does not appear at all -- the guard is matching nothing")
	}
	for _, m := range matches {
		// Both sides must be a quote. One side is not enough: in
		// fmt.Sprintf("desc=$%d") the byte before desc is a quote too, and a
		// one-sided check let that mutant through.
		prev := byte(0)
		if m[0] > 0 {
			prev = body[m[0]-1]
		}
		next := byte(0)
		if m[1] < len(body) {
			next = body[m[1]]
		}
		if prev != '"' || next != '"' {
			t.Errorf("desc is not quoted as a whole identifier (prev=%q next=%q): ...%s...",
				prev, next, window(body, m[0], m[1]))
		}
	}
}

// window is the error context around a match.
func window(s string, a, b int) string {
	start := a - 30
	if start < 0 {
		start = 0
	}
	end := b + 30
	if end > len(s) {
		end = len(s)
	}
	return s[start:end]
}

// TestCreateQuotesTheReservedColumn pins the INSERT statement as the driver
// sees it. The column list and the select list must quote identically, so a
// future edit cannot re-introduce a bare desc in one place only.
func TestCreateQuotesTheReservedColumn(t *testing.T) {
	r, mock := newMock(t)
	now := time.Now().UTC()

	mock.ExpectExec("INSERT INTO permissions ( id, name, code, resource, action, \"desc\", tenant_id, user_id, created_at, updated_at ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)").
		WithArgs("perm-1", "Deploy", "deploy:create", "pipeline", "create", "create a pipeline", "tenant-alpha", "user-1", now, now).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := r.Create(context.Background(), &models.Permission{
		ID: "perm-1", Name: "Deploy", Code: "deploy:create",
		Resource: "pipeline", Action: "create", Desc: "create a pipeline",
		TenantID: "tenant-alpha", UserID: "user-1", CreatedAt: now, UpdatedAt: now,
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func stringPtr(s string) *string { return &s }
