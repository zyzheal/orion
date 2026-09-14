package repository

import (
	"context"
	"database/sql"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/go-common/pkg/database"
	"orion/platform-svc-go/internal/tool/models"
)

func readFile(name string) ([]byte, error) {
	return os.ReadFile(name)
}

func newInvMock(t *testing.T) (*InvocationRepository, sqlmock.Sqlmock) {
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
	return NewInvocationRepository(&database.DB{DB: sqlx.NewDb(raw, "postgres")}), mock
}

func TestInvocationCreate(t *testing.T) {
	repo, mock := newInvMock(t)
	mock.ExpectExec(`INSERT INTO tool_invocations (id, tool_id, tenant_id, input, output, status, error, duration, called_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`).
		WithArgs(testInvID, testToolID, testTenant, `{"q":1}`, "{}", "success", nil, int64(5), "u-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	inv := &models.ToolInvocation{
		ID: testInvID, ToolID: testToolID, TenantID: testTenant,
		Input: `{"q":1}`, Output: "{}", Status: "success", Duration: 5, CalledBy: "u-1",
	}
	if err := repo.Create(context.Background(), inv); err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestInvocationGetByIDIsTenantScoped(t *testing.T) {
	repo, mock := newInvMock(t)
	mock.ExpectQuery(`SELECT `+invocationCols+` FROM tool_invocations WHERE id=$1 AND tenant_id=$2`).
		WithArgs(testInvID, testTenant).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tool_id", "tenant_id", "input", "output", "status", "error", "duration", "called_by", "created_at"}).
			AddRow(testInvID, testToolID, testTenant, `{"q":1}`, "{}", "success", nil, int64(5), "u-1", time.Now()))

	got, err := repo.GetByID(context.Background(), testTenant, testInvID)
	if err != nil {
		t.Fatalf("GetByID() error = %v", err)
	}
	if got == nil || got.TenantID != testTenant || got.ToolID != testToolID {
		t.Fatalf("GetByID() = %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestInvocationListByToolIsTenantScoped(t *testing.T) {
	repo, mock := newInvMock(t)
	query := `SELECT ` + invocationCols + ` FROM tool_invocations WHERE tenant_id=$1 AND tool_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`
	mock.ExpectQuery(query).
		WithArgs(testTenant, testToolID, 20, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tool_id", "tenant_id", "input", "output", "status", "error", "duration", "called_by", "created_at"}).
			AddRow(testInvID, testToolID, testTenant, "{}", "{}", "success", nil, int64(0), "u-1", time.Now()))

	invs, err := repo.ListByTool(context.Background(), testTenant, testToolID, 20, 0)
	if err != nil {
		t.Fatalf("ListByTool() error = %v", err)
	}
	if len(invs) != 1 || invs[0].ToolID != testToolID {
		t.Fatalf("ListByTool() = %+v", invs)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestInvocationClampsLimit(t *testing.T) {
	repo, mock := newInvMock(t)
	query := `SELECT ` + invocationCols + ` FROM tool_invocations WHERE tenant_id=$1 AND tool_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`
	mock.ExpectQuery(query).
		WithArgs(testTenant, testToolID, 20, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tool_id", "tenant_id", "input", "output", "status", "error", "duration", "called_by", "created_at"}))

	// limit=0 must be clamped to the default 20, not passed through.
	_, err := repo.ListByTool(context.Background(), testTenant, testToolID, 0, 0)
	if err != nil {
		t.Fatalf("ListByTool(limit=0) error = %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestStatsByPeriodBindsTenant(t *testing.T) {
	repo, mock := newInvMock(t)
	mock.ExpectQuery(`SELECT COUNT(*)::BIGINT AS total_invocations, SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)::BIGINT AS successful_calls, SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END)::BIGINT AS failed_calls, ROUND(SUM(CASE WHEN status = 'success' THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(*), 0), 4) AS success_rate, ROUND(AVG(duration)::DOUBLE PRECISION, 2) AS avg_duration_ms, PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration)::BIGINT AS p95_duration_ms, PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration)::BIGINT AS p99_duration_ms, COUNT(DISTINCT called_by)::BIGINT AS active_users FROM tool_invocations WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '1 day'`).
		WithArgs(testTenant).
		WillReturnRows(sqlmock.NewRows([]string{"total_invocations", "successful_calls", "failed_calls", "success_rate", "avg_duration_ms", "p95_duration_ms", "p99_duration_ms", "active_users"}).
			AddRow(10, 8, 2, 0.8, 100.0, 500, 900, 3))

	stats, err := repo.StatsByPeriod(context.Background(), testTenant, "day")
	if err != nil {
		t.Fatalf("StatsByPeriod() error = %v", err)
	}
	if stats == nil || stats.TotalInvocations != 10 || stats.SuccessRate != 0.8 {
		t.Fatalf("StatsByPeriod() = %+v", stats)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestTopToolsJoinsToolsByTenant(t *testing.T) {
	repo, mock := newInvMock(t)
	mock.ExpectQuery(`SELECT ti.tool_id, t.name AS tool_name, t.category, COUNT(*)::BIGINT AS invocation_count FROM tool_invocations ti JOIN tools t ON t.id = ti.tool_id WHERE ti.tenant_id = $1 GROUP BY ti.tool_id, t.name, t.category ORDER BY invocation_count DESC LIMIT $2`).
		WithArgs(testTenant, 10).
		WillReturnRows(sqlmock.NewRows([]string{"tool_id", "tool_name", "category", "invocation_count"}).
			AddRow(testToolID, "tool-a", "ci", int64(7)))

	ranks, err := repo.TopToolsByInvocations(context.Background(), testTenant, 10)
	if err != nil {
		t.Fatalf("TopToolsByInvocations() error = %v", err)
	}
	if len(ranks) != 1 || ranks[0].ToolID != testToolID || ranks[0].InvocationCount != 7 {
		t.Fatalf("TopToolsByInvocations() = %+v", ranks)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func newVerMock(t *testing.T) (*VersionRepository, sqlmock.Sqlmock) {
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
	return NewVersionRepository(&database.DB{DB: sqlx.NewDb(raw, "postgres")}), mock
}

func TestVersionListIsScopedByTool(t *testing.T) {
	repo, mock := newVerMock(t)
	// tool_versions has no tenant column: it is reached through a parent tool
	// owned by the caller's tenant (the service resolves the tool with a
	// tenant-scoped GetByID before this runs), so the query is scoped by
	// tool_id alone.
	mock.ExpectQuery(`SELECT ` + versionCols + ` FROM tool_versions WHERE tool_id=$1 ORDER BY created_at DESC`).
		WithArgs(testToolID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tool_id", "version", "config", "changelog", "created_by", "created_at"}).
			AddRow(testVerID, testToolID, "1.0", "{}", "init", "u-1", time.Now()))

	versions, err := repo.ListByTool(context.Background(), testToolID)
	if err != nil {
		t.Fatalf("ListByTool() error = %v", err)
	}
	if len(versions) != 1 || versions[0].ToolID != testToolID {
		t.Fatalf("ListByTool() = %+v", versions)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestInvocationGetByIDReturnsNilForNoRows pins the not-found convention: a
// missing row yields (nil, nil), never (nil, error).
func TestInvocationGetByIDReturnsNilForNoRows(t *testing.T) {
	repo, mock := newInvMock(t)
	mock.ExpectQuery(`SELECT `+invocationCols+` FROM tool_invocations WHERE id=$1 AND tenant_id=$2`).
		WithArgs(testInvID, testTenant).
		WillReturnError(sql.ErrNoRows)

	got, err := repo.GetByID(context.Background(), testTenant, testInvID)
	if err != nil {
		t.Fatalf("GetByID() error = %v, want nil", err)
	}
	if got != nil {
		t.Fatalf("GetByID() = %+v, want nil", got)
	}
}

// TestNoToolStatementUsesSelectStar pins the column discipline at the SQL text
// level, so a future regression back to SELECT * is caught without a database.
func TestNoToolStatementUsesSelectStar(t *testing.T) {
	files := []string{"tool_repository.go", "invocation_repository.go"}
	for _, f := range files {
		src := mustReadFile(t, f)
		if strings.Contains(src, "SELECT * FROM") {
			t.Fatalf("%s still uses SELECT *", f)
		}
	}
}

func mustReadFile(t *testing.T, name string) string {
	t.Helper()
	b, err := readFile(name)
	if err != nil {
		t.Fatalf("read %s: %v", name, err)
	}
	return string(b)
}
