package repository

import (
	"context"
	"database/sql"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/go-common/pkg/database"
	"orion/platform-svc-go/internal/tool/models"
)

// Repository tests drive the real repository over sqlmock so they pin the exact
// SQL text, the argument order and the column mapping. That is where the tool
// module's persistence defects lived:
//
//   - the module's four tables (tools, tool_categories, tool_versions,
//     tool_invocations) were never created by any migration, so every statement
//     failed at the driver with "relation does not exist" — the whole module
//     answered 500 on every endpoint;
//   - every SELECT used SELECT *, so a table migration that later adds a column
//     breaks all reads via sqlx's strict "missing destination name" error;
//   - ToolRepository.GetByID and InvocationRepository.GetByID swallowed
//     sql.ErrNoRows and returned (nil, nil) but every other read surfaced the
//     driver error, leaving no consistent not-found story.
//
// Verify with:
//
//	go test -count=1 ./internal/tool/repository/
//
// The SELECT column lists below are assembled from the same constants the
// repository uses, so an implementation change that adds a column updates both
// sides together rather than drifting.

var (
	testTenant = "11111111-1111-1111-1111-111111111111"
	testToolID = "22222222-2222-2222-2222-222222222222"
	testCatID  = "33333333-3333-3333-3333-333333333333"
	testInvID  = "44444444-4444-4444-4444-444444444444"
	testVerID  = "55555555-5555-5555-5555-555555555555"
)

func normalize2(s string) string {
	return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(s, " "))
}

func newToolMock(t *testing.T) (*ToolRepository, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		if normalize2(expected) == normalize2(actual) {
			return nil
		}
		return &sqlMismatch{expected: normalize2(expected), actual: normalize2(actual)}
	})))
	if err != nil {
		t.Fatalf("sqlmock.New() error = %v", err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return NewToolRepository(&database.DB{DB: sqlx.NewDb(raw, "postgres")}), mock
}

type sqlMismatch struct{ expected, actual string }

func (m *sqlMismatch) Error() string {
	return "sql mismatch:\n  expected: " + m.expected + "\n     actual: " + m.actual
}

func TestToolCreateBindsCallerTenant(t *testing.T) {
	repo, mock := newToolMock(t)
	// sqlx's NamedExec rewrites :name placeholders to $N before the statement is
	// sent, so the matcher sees the positional form.
	mock.ExpectExec(`INSERT INTO tools (id, tenant_id, name, display_name, description, category, type, version, config, endpoint, auth_type, auth_config, tags, status, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`).
		WithArgs(sqlmock.AnyArg(), testTenant, "tool-a", "Tool A", "", "ci", "api", "1.0", "{}", "https://x", "none", "{}", "[]", "active", "u-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	tool := &models.Tool{
		ID: testToolID, TenantID: testTenant, Name: "tool-a",
		DisplayName: "Tool A", Category: "ci", Type: "api", Version: "1.0",
		Config: "{}", Endpoint: "https://x",
		AuthType: "none", AuthConfig: "{}", Tags: "[]",
		Status: "active", CreatedBy: "u-1",
	}
	if err := repo.Create(context.Background(), tool); err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestToolGetByIDIsTenantScopedAndMapsEveryColumn(t *testing.T) {
	repo, mock := newToolMock(t)
	rows := sqlmock.NewRows([]string{"id", "tenant_id", "name", "display_name", "description", "category", "type", "version", "config", "endpoint", "auth_type", "auth_config", "tags", "status", "created_by", "created_at", "updated_at", "deprecated_at"}).
		AddRow(testToolID, testTenant, "tool-a", "Tool A", "desc", "ci", "api", "1.0", "{}", "https://x", "none", "{}", "[]", "active", "u-1", time.Now().UTC(), time.Now().UTC(), nil)
	mock.ExpectQuery(`SELECT `+toolCols+` FROM tools WHERE id=$1 AND tenant_id=$2`).
		WithArgs(testToolID, testTenant).
		WillReturnRows(rows)

	got, err := repo.GetByID(context.Background(), testTenant, testToolID)
	if err != nil {
		t.Fatalf("GetByID() error = %v", err)
	}
	if got == nil || got.Name != "tool-a" || got.TenantID != testTenant {
		t.Fatalf("GetByID() = %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestToolGetByIDReturnsNilForNoRows(t *testing.T) {
	repo, mock := newToolMock(t)
	mock.ExpectQuery(`SELECT `+toolCols+` FROM tools WHERE id=$1 AND tenant_id=$2`).
		WithArgs(testToolID, testTenant).
		WillReturnError(sql.ErrNoRows)

	got, err := repo.GetByID(context.Background(), testTenant, testToolID)
	if err != nil {
		t.Fatalf("GetByID() error = %v, want nil error", err)
	}
	if got != nil {
		t.Fatalf("GetByID() = %+v, want nil for a missing row", got)
	}
}

func TestToolListBindsTenantAndFilters(t *testing.T) {
	repo, mock := newToolMock(t)
	mock.ExpectQuery(`SELECT COUNT(*) FROM tools WHERE tenant_id = $1 AND category = $2 AND type = $3`).
		WithArgs(testTenant, "ci", "api").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	query := `SELECT ` + toolCols + ` FROM tools WHERE tenant_id = $1 AND category = $2 AND type = $3 ORDER BY created_at DESC LIMIT $4 OFFSET $5`
	mock.ExpectQuery(query).
		WithArgs(testTenant, "ci", "api", 20, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "display_name", "description", "category", "type", "version", "config", "endpoint", "auth_type", "auth_config", "tags", "status", "created_by", "created_at", "updated_at", "deprecated_at"}).
			AddRow(testToolID, testTenant, "tool-a", "Tool A", "desc", "ci", "api", "1.0", "{}", "", "none", "{}", "[]", "active", "u-1", time.Now(), time.Now(), nil))

	tools, total, err := repo.List(context.Background(), testTenant, models.ToolListParams{Category: "ci", Type: "api"})
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if total != 1 || len(tools) != 1 {
		t.Fatalf("List() = %d/%d, want 1/1", len(tools), total)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestToolUpdateIsTenantScopedAndIncludesWhereTenant(t *testing.T) {
	repo, mock := newToolMock(t)
	// The WHERE clause must carry tenant_id, not just id: an update keyed on id
	// alone lets one tenant overwrite another tenant's tool.
	mock.ExpectExec(`UPDATE tools SET display_name=$1, description=$2, category=$3, version=$4, config=$5, endpoint=$6, auth_type=$7, auth_config=$8, tags=$9, status=$10, updated_at=NOW() WHERE id=$11 AND tenant_id=$12`).
		WithArgs("Tool A", "desc", "ci", "1.0", "{}", "https://x", "none", "{}", "[]", "active", testToolID, testTenant).
		WillReturnResult(sqlmock.NewResult(0, 1))

	tool := &models.Tool{
		ID: testToolID, TenantID: testTenant, Name: "tool-a",
		DisplayName: "Tool A", Description: "desc", Category: "ci",
		Version: "1.0", Config: "{}", Endpoint: "https://x",
		AuthType: "none", AuthConfig: "{}", Tags: "[]", Status: "active",
	}
	if err := repo.Update(context.Background(), tool); err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestToolGetCategoriesIsTenantScoped(t *testing.T) {
	repo, mock := newToolMock(t)
	mock.ExpectQuery(`SELECT `+categoryCols+` FROM tool_categories WHERE tenant_id=$1 ORDER BY sort_order`).
		WithArgs(testTenant).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "display_name", "description", "icon", "sort_order", "created_at"}).
			AddRow(testCatID, testTenant, "ci", "CI/CD", "cicd", "icon", 1, time.Now()))

	cats, err := repo.GetCategories(context.Background(), testTenant)
	if err != nil {
		t.Fatalf("GetCategories() error = %v", err)
	}
	if len(cats) != 1 || cats[0].TenantID != testTenant {
		t.Fatalf("GetCategories() = %+v", cats)
	}
}

func TestToolSearchIsTenantScoped(t *testing.T) {
	repo, mock := newToolMock(t)
	mock.ExpectQuery(`SELECT `+toolCols+` FROM tools WHERE tenant_id=$1 AND status='active' AND (name ILIKE $2 ESCAPE '\' OR display_name ILIKE $2 ESCAPE '\' OR description ILIKE $2 ESCAPE '\') ORDER BY name LIMIT $3`).
		WithArgs(testTenant, "%tool%", 20).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "display_name", "description", "category", "type", "version", "config", "endpoint", "auth_type", "auth_config", "tags", "status", "created_by", "created_at", "updated_at", "deprecated_at"}).
			AddRow(testToolID, testTenant, "tool-a", "Tool A", "desc", "ci", "api", "1.0", "{}", "", "none", "{}", "[]", "active", "u-1", time.Now(), time.Now(), nil))

	tools, err := repo.Search(context.Background(), testTenant, "tool", 20)
	if err != nil {
		t.Fatalf("Search() error = %v", err)
	}
	if len(tools) != 1 {
		t.Fatalf("Search() = %d tools", len(tools))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}