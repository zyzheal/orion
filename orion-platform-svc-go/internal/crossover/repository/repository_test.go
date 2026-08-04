package repository

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ===========================================================================
// sqlmockTest — reusable wrapper
// ===========================================================================

type sqlmockTest struct {
	db   *sqlx.DB
	mock sqlmock.Sqlmock
}

func anyArgs(n int) []driver.Value {
	args := make([]driver.Value, n)
	for i := range args {
		args[i] = sqlmock.AnyArg()
	}
	return args
}

func newSQLMockTest() *sqlmockTest {
	dr, m, err := sqlmock.New()
	if err != nil {
		panic(err)
	}
	db := sqlx.NewDb(dr, "postgres")
	return &sqlmockTest{db: db, mock: m}
}

func (s *sqlmockTest) repo() *Repository {
	return NewRepository(s.db)
}

// ===========================================================================
// Test helpers
// ===========================================================================

func makeTestCall() *CallRecord {
	return &CallRecord{
		ID:           uuid.NewString(),
		TenantID:     "tenant-1",
		SourceDomain: "ci-cd",
		TargetDomain: "deploy",
		Method:       "deploy.release",
		Status:       "succeeded",
		Duration:     1200,
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
}

func appendCallRows(call *CallRecord) *sqlmock.Rows {
	return sqlmock.NewRows(columns).AddRow(
		call.ID, call.TenantID, call.SourceDomain, call.TargetDomain, call.Method,
		"", "", call.Status, call.Duration,
		call.CreatedAt, call.UpdatedAt,
	)
}

var columns = []string{
	"id", "tenant_id", "source_domain", "target_domain", "method",
	"payload", "response", "status", "duration_ms", "created_at", "updated_at",
}

// ===========================================================================
// CreateCall
// ===========================================================================

func TestCreateCall(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	call := makeTestCall()

	st.mock.ExpectQuery("INSERT INTO crossover_calls").
		WithArgs(anyArgs(11)...).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(call.ID))

	err := st.repo().CreateCall(ctx, call)
	require.NoError(t, err)
	require.NoError(t, st.mock.ExpectationsWereMet())
}

func TestCreateCallReturnsID(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	call := makeTestCall()
	returnedID := uuid.NewString()

	st.mock.ExpectQuery("INSERT INTO crossover_calls").
		WithArgs(anyArgs(11)...).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(returnedID))

	err := st.repo().CreateCall(ctx, call)
	require.NoError(t, err)
	assert.Equal(t, returnedID, call.ID)
}

func TestCreateCallDBError(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	call := makeTestCall()

	st.mock.ExpectQuery("INSERT INTO crossover_calls").
		WithArgs(anyArgs(11)...).
		WillReturnError(fmt.Errorf("duplicate key"))

	err := st.repo().CreateCall(ctx, call)
	assert.Error(t, err)
}

// ===========================================================================
// GetCall
// ===========================================================================

func TestGetCall(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	call := makeTestCall()
	id := uuid.MustParse(call.ID)

	st.mock.ExpectQuery("SELECT \\* FROM crossover_calls").
		WithArgs(id, call.TenantID).
		WillReturnRows(appendCallRows(call))

	result, err := st.repo().GetCall(ctx, call.TenantID, id)
	require.NoError(t, err)
	assert.Equal(t, call.ID, result.ID)
	assert.Equal(t, "succeeded", result.Status)
	assert.Equal(t, int64(1200), result.Duration)
}

func TestGetCallNotFound(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	id := uuid.New()

	st.mock.ExpectQuery("SELECT \\* FROM crossover_calls").
		WithArgs(id, "tenant-1").
		WillReturnError(sql.ErrNoRows)

	_, err := st.repo().GetCall(ctx, "tenant-1", id)
	assert.True(t, errors.Is(err, ErrNotFound))
}

func TestGetCallDBError(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	id := uuid.New()

	st.mock.ExpectQuery("SELECT \\* FROM crossover_calls").
		WithArgs(id, "tenant-1").
		WillReturnError(fmt.Errorf("connection refused"))

	_, err := st.repo().GetCall(ctx, "tenant-1", id)
	assert.Error(t, err)
	assert.False(t, errors.Is(err, ErrNotFound))
}

// ===========================================================================
// ListCalls
// ===========================================================================

func TestListCallsNoFilter(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	calls := makeTestCall()

	st.mock.ExpectQuery("SELECT \\* FROM crossover_calls").
		WithArgs(20, 0).
		WillReturnRows(appendCallRows(calls))

	items, err := st.repo().ListCalls(ctx, CallFilter{})
	require.NoError(t, err)
	assert.Len(t, items, 1)
}

func TestListCallsByTenantFilter(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	calls := makeTestCall()

	st.mock.ExpectQuery("SELECT \\* FROM crossover_calls").
		WithArgs(calls.TenantID, 20, 0).
		WillReturnRows(appendCallRows(calls))

	items, err := st.repo().ListCalls(ctx, CallFilter{TenantID: calls.TenantID})
	require.NoError(t, err)
	assert.Len(t, items, 1)
	assert.Equal(t, calls.TenantID, items[0].TenantID)
}

func TestListCallsByStatus(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	calls := makeTestCall()
	calls.Status = "failed"

	st.mock.ExpectQuery("SELECT \\* FROM crossover_calls").
		WithArgs("failed", 20, 0).
		WillReturnRows(appendCallRows(calls))

	items, err := st.repo().ListCalls(ctx, CallFilter{Status: "failed"})
	require.NoError(t, err)
	assert.Equal(t, "failed", items[0].Status)
}

func TestListCallsByDomain(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	calls := makeTestCall()

	st.mock.ExpectQuery("SELECT \\* FROM crossover_calls").
		WithArgs(calls.TargetDomain, 20, 0).
		WillReturnRows(appendCallRows(calls))

	items, err := st.repo().ListCalls(ctx, CallFilter{TargetDomain: calls.TargetDomain})
	require.NoError(t, err)
	assert.Equal(t, calls.TargetDomain, items[0].TargetDomain)
}

func TestListCallsByMethod(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	calls := makeTestCall()

	st.mock.ExpectQuery("SELECT \\* FROM crossover_calls").
		WithArgs(calls.Method, 20, 0).
		WillReturnRows(appendCallRows(calls))

	items, err := st.repo().ListCalls(ctx, CallFilter{Method: calls.Method})
	require.NoError(t, err)
	assert.Equal(t, calls.Method, items[0].Method)
}

func TestListCallsByTimeRange(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	start := time.Now().UTC().Add(-time.Hour)
	end := time.Now().UTC().Add(time.Hour)
	calls := makeTestCall()

	st.mock.ExpectQuery("SELECT \\* FROM crossover_calls").
		WithArgs(start, end, 20, 0).
		WillReturnRows(appendCallRows(calls))

	items, err := st.repo().ListCalls(ctx, CallFilter{
		StartTime: &start,
		EndTime:   &end,
	})
	require.NoError(t, err)
	assert.Len(t, items, 1)
}

func TestListCallsByAllFilters(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	start := time.Now().UTC().Add(-time.Hour)
	end := time.Now().UTC().Add(time.Hour)
	calls := makeTestCall()

	st.mock.ExpectQuery("SELECT \\* FROM crossover_calls").
		WithArgs(calls.TenantID, calls.SourceDomain, calls.TargetDomain,
			calls.Method, "failed", start, end, 20, 0).
		WillReturnRows(appendCallRows(calls))

	items, err := st.repo().ListCalls(ctx, CallFilter{
		TenantID:     calls.TenantID,
		SourceDomain: calls.SourceDomain,
		TargetDomain: calls.TargetDomain,
		Method:       calls.Method,
		Status:       "failed",
		StartTime:    &start,
		EndTime:      &end,
	})
	require.NoError(t, err)
	assert.Len(t, items, 1)
}

func TestListCallsLimit(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()

	st.mock.ExpectQuery("SELECT \\* FROM crossover_calls").
		WithArgs(5, 0).
		WillReturnRows(sqlmock.NewRows(columns))

	_, err := st.repo().ListCalls(ctx, CallFilter{Limit: 5})
	assert.NoError(t, err)
}

// ===========================================================================
// UpdateStatus
// ===========================================================================

func TestUpdateStatus(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	calls := makeTestCall()
	id := uuid.MustParse(calls.ID)

	st.mock.ExpectExec("UPDATE crossover_calls").
		WithArgs("failed", sqlmock.AnyArg(), id, calls.TenantID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := st.repo().UpdateStatus(ctx, calls.TenantID, id, "failed")
	assert.NoError(t, err)
}

func TestUpdateStatusDBError(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	calls := makeTestCall()
	id := uuid.MustParse(calls.ID)

	st.mock.ExpectExec("UPDATE crossover_calls").
		WithArgs("failed", sqlmock.AnyArg(), id, calls.TenantID).
		WillReturnError(fmt.Errorf("lock timeout"))

	err := st.repo().UpdateStatus(ctx, calls.TenantID, id, "failed")
	assert.Error(t, err)
}

// ===========================================================================
// UpdateCall
// ===========================================================================

func TestUpdateCall(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	calls := makeTestCall()

	st.mock.ExpectExec("UPDATE crossover_calls").
		WithArgs(calls.SourceDomain, calls.TargetDomain, calls.Method,
			"", "", calls.Status, calls.Duration, calls.UpdatedAt, calls.ID, calls.TenantID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := st.repo().UpdateCall(ctx, calls.TenantID, calls)
	assert.NoError(t, err)
}

func TestUpdateCallDBError(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	calls := makeTestCall()

	st.mock.ExpectExec("UPDATE crossover_calls").
		WillReturnError(fmt.Errorf("constraint violation"))

	err := st.repo().UpdateCall(ctx, "tenant-1", calls)
	assert.Error(t, err)
}

// ===========================================================================
// DeleteCall
// ===========================================================================

func TestDeleteCall(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	calls := makeTestCall()
	id := uuid.MustParse(calls.ID)

	st.mock.ExpectExec("DELETE FROM crossover_calls").
		WithArgs(id, calls.TenantID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := st.repo().DeleteCall(ctx, calls.TenantID, id)
	assert.NoError(t, err)
}

func TestDeleteCallDBError(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	id := uuid.New()

	st.mock.ExpectExec("DELETE FROM crossover_calls").
		WillReturnError(fmt.Errorf("permission denied"))

	err := st.repo().DeleteCall(ctx, "tenant-1", id)
	assert.Error(t, err)
}

// ===========================================================================
// GetCallStats
// ===========================================================================

func TestGetCallStats(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	tenant := "tenant-1"
	start := time.Now().UTC().Add(-time.Hour)
	end := time.Now().UTC().Add(time.Hour)
	dv := make([]driver.Value, 3); dv[0] = tenant; dv[1] = start; dv[2] = end

	st.mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WithArgs(dv...).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(5)))
	st.mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WithArgs(dv...).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(3)))
	st.mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WithArgs(dv...).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(2)))
	st.mock.ExpectQuery("SELECT COALESCE\\(AVG").
		WithArgs(dv...).
		WillReturnRows(sqlmock.NewRows([]string{"avg"}).AddRow(float64(3800)))
	st.mock.ExpectQuery("SELECT PERCENTILE_CONT").
		WithArgs(dv...).
		WillReturnRows(sqlmock.NewRows([]string{"p99"}).AddRow(float64(8000)))

	stats, err := st.repo().GetCallStats(ctx, tenant, start, end)
	require.NoError(t, err)
	assert.Equal(t, int64(5), stats.TotalCalls)
	assert.Equal(t, int64(3), stats.SuccessCalls)
	assert.Equal(t, int64(2), stats.FailedCalls)
	assert.Equal(t, float64(3800), stats.AvgDuration)
	assert.Equal(t, float64(8000), stats.P99Duration)
}

func TestGetCallStatsEmptyWindow(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	dv := make([]driver.Value, 3); dv[0] = "tenant-1"; dv[1] = sqlmock.AnyArg(); dv[2] = sqlmock.AnyArg()

	st.mock.ExpectQuery("SELECT COUNT\\(\\*\\)").WithArgs(dv...).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(0)))
	st.mock.ExpectQuery("SELECT COUNT\\(\\*\\)").WithArgs(dv...).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(0)))
	st.mock.ExpectQuery("SELECT COUNT\\(\\*\\)").WithArgs(dv...).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(0)))
	st.mock.ExpectQuery("SELECT COALESCE\\(AVG").WithArgs(dv...).
		WillReturnRows(sqlmock.NewRows([]string{"avg"}).AddRow(float64(0)))
	st.mock.ExpectQuery("SELECT PERCENTILE_CONT").WithArgs(dv...).
		WillReturnRows(sqlmock.NewRows([]string{"p99"}).AddRow(float64(0)))

	stats, err := st.repo().GetCallStats(ctx, "tenant-1", time.Time{}, time.Time{})
	require.NoError(t, err)
	assert.Equal(t, int64(0), stats.TotalCalls)
}

func TestGetCallStatsFailsOnFirstQuery(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	dv := make([]driver.Value, 3); dv[0] = "t1"; dv[1] = sqlmock.AnyArg(); dv[2] = sqlmock.AnyArg()

	st.mock.ExpectQuery("SELECT COUNT\\(\\*\\)").WithArgs(dv...).
		WillReturnError(fmt.Errorf("connection reset"))

	_, err := st.repo().GetCallStats(ctx, "t1", time.Time{}, time.Time{})
	assert.Error(t, err)
}

// ===========================================================================
// GetCallStatsByTarget
// ===========================================================================

func TestGetCallStatsByTarget(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	tenant := "tenant-1"
	target := "deploy"
	start := time.Now().UTC().Add(-time.Hour)
	end := time.Now().UTC().Add(time.Hour)
	dv := make([]driver.Value, 4); dv[0] = tenant; dv[1] = target; dv[2] = start; dv[3] = end

	st.mock.ExpectQuery("SELECT COUNT\\(\\*\\)").WithArgs(dv...).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(2)))
	st.mock.ExpectQuery("SELECT COUNT\\(\\*\\)").WithArgs(dv...).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(1)))
	st.mock.ExpectQuery("SELECT COUNT\\(\\*\\)").WithArgs(dv...).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(1)))
	st.mock.ExpectQuery("SELECT COALESCE\\(AVG").WithArgs(dv...).
		WillReturnRows(sqlmock.NewRows([]string{"avg"}).AddRow(float64(1000)))
	st.mock.ExpectQuery("SELECT PERCENTILE_CONT").WithArgs(dv...).
		WillReturnRows(sqlmock.NewRows([]string{"p99"}).AddRow(float64(1000)))

	stats, err := st.repo().GetCallStatsByTarget(ctx, tenant, target, start, end)
	require.NoError(t, err)
	assert.Equal(t, int64(2), stats.TotalCalls)
	assert.Equal(t, int64(1), stats.SuccessCalls)
	assert.Equal(t, int64(1), stats.FailedCalls)
}

func TestGetCallStatsByTargetNone(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	dv := make([]driver.Value, 4); dv[0] = "t1"; dv[1] = "nonexistent"; dv[2] = sqlmock.AnyArg(); dv[3] = sqlmock.AnyArg()

	for i := 0; i < 3; i++ {
		st.mock.ExpectQuery("SELECT COUNT\\(\\*\\)").WithArgs(dv...).
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(0)))
	}
	st.mock.ExpectQuery("SELECT COALESCE\\(AVG").WithArgs(dv...).
		WillReturnRows(sqlmock.NewRows([]string{"avg"}).AddRow(float64(0)))
	st.mock.ExpectQuery("SELECT PERCENTILE_CONT").WithArgs(dv...).
		WillReturnRows(sqlmock.NewRows([]string{"p99"}).AddRow(float64(0)))

	stats, err := st.repo().GetCallStatsByTarget(ctx, "t1", "nonexistent", time.Time{}, time.Time{})
	require.NoError(t, err)
	assert.Equal(t, int64(0), stats.TotalCalls)
}

func TestGetCallStatsByTargetFailsOnFirstQuery(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	dv := make([]driver.Value, 4); dv[0] = "t"; dv[1] = "x"; dv[2] = sqlmock.AnyArg(); dv[3] = sqlmock.AnyArg()

	st.mock.ExpectQuery("SELECT COUNT\\(\\*\\)").WithArgs(dv...).
		WillReturnError(fmt.Errorf("broken pipe"))

	_, err := st.repo().GetCallStatsByTarget(ctx, "t", "x", time.Time{}, time.Time{})
	assert.Error(t, err)
}

// ===========================================================================
// CreateTable (migration)
// ===========================================================================

func TestCreateTable(t *testing.T) {
	st := newSQLMockTest()

	st.mock.ExpectExec("CREATE TABLE IF NOT EXISTS crossover_calls").
		WillReturnResult(sqlmock.NewResult(0, 0))
	st.mock.ExpectExec("CREATE INDEX IF NOT EXISTS idx_crossover_calls_tenant").
		WillReturnResult(sqlmock.NewResult(0, 0))
	st.mock.ExpectExec("CREATE INDEX IF NOT EXISTS idx_crossover_calls_created_at").
		WillReturnResult(sqlmock.NewResult(0, 0))
	st.mock.ExpectExec("CREATE INDEX IF NOT EXISTS idx_crossover_calls_status").
		WillReturnResult(sqlmock.NewResult(0, 0))
	st.mock.ExpectExec("CREATE INDEX IF NOT EXISTS idx_crossover_calls_target").
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := st.repo().CreateTable()
	require.NoError(t, err)
}

func TestCreateTableFails(t *testing.T) {
	st := newSQLMockTest()

	st.mock.ExpectExec("CREATE TABLE IF NOT EXISTS crossover_calls").
		WillReturnError(fmt.Errorf("permission denied"))

	err := st.repo().CreateTable()
	assert.Error(t, err)
}

// ===========================================================================
// Tenant isolation (mock-based)
// ===========================================================================

func TestTenantIsolationGetWrongTenant(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()
	calls := makeTestCall()
	id := uuid.MustParse(calls.ID)

	// Wrong tenant — repo passes tenant_id as 2nd arg, sqlmock rejects
	st.mock.ExpectQuery("SELECT \\* FROM crossover_calls").
		WithArgs(id, "wrong-tenant").
		WillReturnError(sql.ErrNoRows)

	_, err := st.repo().GetCall(ctx, "wrong-tenant", id)
	assert.True(t, errors.Is(err, ErrNotFound))
}

func TestTenantIsolationListWrongTenant(t *testing.T) {
	st := newSQLMockTest()
	ctx := context.Background()

	// Repo passes "wrong-tenant" as first filter arg; sqlmock returns 0 rows
	st.mock.ExpectQuery("SELECT \\* FROM crossover_calls").
		WithArgs("wrong-tenant", 20, 0).
		WillReturnRows(sqlmock.NewRows(columns)) // 0 rows

	items, err := st.repo().ListCalls(ctx, CallFilter{TenantID: "wrong-tenant"})
	require.NoError(t, err)
	assert.Empty(t, items)
}

// ===========================================================================
// buildCallFilterClause helper
// ===========================================================================

func TestBuildCallFilterClauseNoFilters(t *testing.T) {
	where, args := buildCallFilterClause(CallFilter{})
	assert.Equal(t, "WHERE 1=1", where)
	assert.Len(t, args, 0)
}

func TestBuildCallFilterClauseAllFilters(t *testing.T) {
	start := time.Now().UTC().Add(-time.Hour)
	end := time.Now().UTC().Add(time.Hour)

	where, args := buildCallFilterClause(CallFilter{
		TenantID:     "t1",
		SourceDomain: "src",
		TargetDomain: "tgt",
		Status:       "ok",
		StartTime:    &start,
		EndTime:      &end,
	})

	assert.Contains(t, where, "tenant_id = $1")
	assert.Contains(t, where, "source_domain = $2")
	assert.Contains(t, where, "target_domain = $3")
	assert.Contains(t, where, "status = $4")
	assert.Contains(t, where, "created_at >= $5")
	assert.Contains(t, where, "created_at <= $6")
	assert.Len(t, args, 6)
}

func TestBuildCallFilterClauseStatusOnly(t *testing.T) {
	where, args := buildCallFilterClause(CallFilter{Status: "failed"})
	assert.Contains(t, where, "status = $1")
	assert.Len(t, args, 1)
	assert.Equal(t, "failed", args[0])
}

// ===========================================================================
// DefaultLimit
// ===========================================================================

func TestCallFilterDefaultLimit(t *testing.T) {
	assert.Equal(t, 20, CallFilter{}.DefaultLimit())
	assert.Equal(t, 20, CallFilter{Limit: -1}.DefaultLimit())
	assert.Equal(t, 20, CallFilter{Limit: 0}.DefaultLimit())
	assert.Equal(t, 100, CallFilter{Limit: 200}.DefaultLimit())
	assert.Equal(t, 50, CallFilter{Limit: 50}.DefaultLimit())
}

// ===========================================================================
// EncodeJSONB helper
// ===========================================================================

func TestEncodeJSONBNil(t *testing.T) {
	assert.Equal(t, "", encodeJSONB(nil))
}

func TestEncodeJSONBEmpty(t *testing.T) {
	assert.Equal(t, "{}", encodeJSONB(JSONB{}))
}

func TestEncodeJSONBWithValue(t *testing.T) {
	val := encodeJSONB(JSONB{"a": "b"})
	assert.Contains(t, val, `"a"`)
	assert.Contains(t, val, `"b"`)
}

// ===========================================================================
// Concurrent safety (no-op check)
// ===========================================================================

func TestRepoStructIsGoroutineSafe(t *testing.T) {
	// Repository holds only *sqlx.DB — no in-memory mutable state —
	// so concurrent callers share only the DB driver connection.
	// This test documents the design invariant.
	_ = NewRepository(&sqlx.DB{})
}
