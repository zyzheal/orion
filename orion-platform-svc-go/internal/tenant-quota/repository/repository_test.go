package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/tenant-quota/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// The matcher compares statements after collapsing whitespace, so an
// expectation written against a full "SELECT ... FROM tenant_quota_plan WHERE
// ..." statement cannot quietly satisfy a statement that only says
// "WHERE tenant_id = $1". That is the defect under test here.
var ws = regexp.MustCompile(`\s+`)

func normSQL(s string) string {
	return strings.TrimSpace(ws.ReplaceAllString(s, " "))
}

func mockDB(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		if normSQL(expected) != normSQL(actual) {
			return fmt.Errorf("sql mismatch: want %q got %q", expected, actual)
		}
		return nil
	})))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return sqlx.NewDb(raw, "postgres"), mock
}

// mockDBRecording returns a database plus a record of every statement it was
// handed, so a test can assert that a statement was never issued.
// ExpectationsWereMet cannot prove that for an expectation that was never
// registered.
func mockDBRecording(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock, *[]string) {
	t.Helper()
	seen := []string{}
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		seen = append(seen, normSQL(actual))
		if normSQL(expected) != normSQL(actual) {
			return fmt.Errorf("sql mismatch: want %q got %q", expected, actual)
		}
		return nil
	})))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return sqlx.NewDb(raw, "postgres"), mock, &seen
}

// Hand-transcribed copies of the SELECT lists the repository emits. Writing
// them out instead of referencing planColumns keeps this test able to fail
// when the repository's column list drifts.
const planList = "SELECT id, tenant_id, name, description, status, api_rate_limit_per_min, api_rate_limit_per_hour, max_cis, max_users, max_storages_mb, max_pipelines, max_concurrent_jobs, max_alerts_per_day, sla_tier, soft_limit, hard_limit, over_limit_action, warn_thresholds, created_at, updated_at"

const usageList = "SELECT id, tenant_id, metric, current_value, peak_value, window_start, window_end, reset_at, updated_at"

const alertList = "SELECT id, tenant_id, metric, current_value, limit_value, usage_pct, alert_level, notified_at"

const planCreate = "INSERT INTO tenant_quota_plan (id, tenant_id, name, description, status, " +
	"api_rate_limit_per_min, api_rate_limit_per_hour, max_cis, max_users, max_storages_mb, " +
	"max_pipelines, max_concurrent_jobs, max_alerts_per_day, sla_tier, soft_limit, hard_limit, " +
	"over_limit_action, warn_thresholds, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)"

const usageCreate = "INSERT INTO tenant_quota_usage (id, tenant_id, metric, current_value, peak_value, " +
	"window_start, window_end, reset_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)"

const alertCreate = "INSERT INTO tenant_quota_alert (id, tenant_id, metric, current_value, limit_value, " +
	"usage_pct, alert_level, notified_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"

var planRowNames = []string{
	"id", "tenant_id", "name", "description", "status",
	"api_rate_limit_per_min", "api_rate_limit_per_hour",
	"max_cis", "max_users", "max_storages_mb", "max_pipelines",
	"max_concurrent_jobs", "max_alerts_per_day", "sla_tier",
	"soft_limit", "hard_limit", "over_limit_action", "warn_thresholds",
	"created_at", "updated_at",
}

var usageRowNames = []string{
	"id", "tenant_id", "metric", "current_value", "peak_value",
	"window_start", "window_end", "reset_at", "updated_at",
}

var alertRowNames = []string{
	"id", "tenant_id", "metric", "current_value", "limit_value",
	"usage_pct", "alert_level", "notified_at",
}

func planFixture(t *testing.T, thresholds string) *sqlmock.Rows {
	t.Helper()
	now := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	return sqlmock.NewRows(planRowNames).AddRow(
		"qp-1", "t-1", "Enterprise", "Enterprise plan", "active",
		10000, 500000, 50000, 5000, int64(1048576), 500, 100, 50000, "gold",
		int64(4000), int64(5000), "warn", thresholds, now, now)
}

func TestCreatePlanBindsAllTwentyColumns(t *testing.T) {
	db, mock, seen := mockDBRecording(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL(planCreate)).
		WithArgs("qp-1", "t-1", "Enterprise", "Enterprise plan", "active",
			10000, 500000, 50000, 5000, int64(1048576), 500, 100, 50000, "gold",
			int64(4000), int64(5000), "warn", "50,80,95",
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	p := &models.QuotaPlan{
		ID: "qp-1", TenantID: "t-1", Name: "Enterprise", Description: "Enterprise plan",
		Status: "active", APIRateLimitPerMin: 10000, APIRateLimitPerHour: 500000,
		MaxCIs: 50000, MaxUsers: 5000, MaxStorageMB: 1048576, MaxPipelines: 500,
		MaxConcurrentJobs: 100, MaxAlertsPerDay: 50000, SLATier: "gold",
		SoftLimit: 4000, HardLimit: 5000, OverLimitAction: "warn",
		WarnThresholds: []int{50, 80, 95},
	}
	if err := repo.CreatePlan(context.Background(), p); err != nil {
		t.Fatalf("CreatePlan: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the insert did not reach the database: %v", err)
	}
	if len(*seen) != 1 {
		t.Fatalf("CreatePlan issued %d statements: %v", len(*seen), *seen)
	}
	// The four Phase 306 columns are the ones the pre-R43 INSERT omitted, so a
	// plan created with a policy came back without it.
	for _, col := range []string{"soft_limit", "hard_limit", "over_limit_action", "warn_thresholds"} {
		if !strings.Contains((*seen)[0], col) {
			t.Errorf("the CREATE statement does not name %s: %s", col, (*seen)[0])
		}
	}
	if p.CreatedAt.IsZero() || p.UpdatedAt.IsZero() {
		t.Fatalf("CreatePlan did not populate the timestamps: %+v", p)
	}
}

func TestCreatePlanReturnsAStatementFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("deadlock detected")
	mock.ExpectExec(normSQL(planCreate)).
		// 20 arguments, one per column. The zeros a bare fixture would send are
		// not the point of this test, so only id and tenant_id are pinned.
		WithArgs("qp-1", "t-1", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnError(fail)

	err := repo.CreatePlan(context.Background(), &models.QuotaPlan{ID: "qp-1", TenantID: "t-1"})
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
}

func TestGetPlanDecodesTheThresholdList(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL(planList+" FROM tenant_quota_plan WHERE id = $1 AND tenant_id = $2")).
		WithArgs("qp-1", "t-1").
		WillReturnRows(planFixture(t, "50,80,95"))

	got, err := repo.GetPlan(context.Background(), "qp-1", "t-1")
	if err != nil {
		t.Fatalf("GetPlan: %v", err)
	}
	if got.Name != "Enterprise" || got.SLATier != "gold" {
		t.Fatalf("unexpected row: %+v", got)
	}
	if got.SoftLimit != 4000 || got.HardLimit != 5000 || got.OverLimitAction != "warn" {
		t.Fatalf("the policy fields were not read: %+v", got)
	}
	if len(got.WarnThresholds) != 3 || got.WarnThresholds[1] != 80 {
		t.Fatalf("the threshold list was not decoded: %+v", got.WarnThresholds)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("GetPlan did not issue the expected statement: %v", err)
	}
}

func TestGetPlanReturnsAStatementFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("deadlock detected")
	mock.ExpectQuery(normSQL(planList+" FROM tenant_quota_plan WHERE id = $1 AND tenant_id = $2")).
		WithArgs("qp-1", "t-1").WillReturnError(fail)

	got, err := repo.GetPlan(context.Background(), "qp-1", "t-1")
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
	if got != nil {
		t.Fatalf("a failed read must not return a plan: %+v", got)
	}
}

func TestListPlansUsesAnExplicitColumnListAndSkipsEmptyStrings(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL(planList + " FROM tenant_quota_plan WHERE tenant_id = $1 ORDER BY created_at DESC")).
		WithArgs("t-1").
		WillReturnRows(planFixture(t, ""))

	items, err := repo.ListPlans(context.Background(), "t-1")
	if err != nil {
		t.Fatalf("ListPlans: %v", err)
	}
	if len(items) != 1 || items[0].ID != "qp-1" {
		t.Fatalf("unexpected rows: %+v", items)
	}
	if items[0].WarnThresholds != nil {
		t.Fatalf("an empty threshold column must decode to nil, got %+v", items[0].WarnThresholds)
	}
}

func TestListPlansNormalisesAMalformedThresholdList(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	// Garbage fragments are dropped and the rest is clamped, deduped and
	// sorted, so a hand-edited row cannot produce unsorted warning bands.
	mock.ExpectQuery(normSQL(planList + " FROM tenant_quota_plan WHERE tenant_id = $1 ORDER BY created_at DESC")).
		WithArgs("t-1").
		WillReturnRows(planFixture(t, "150, -3, 42, garbage, 42"))

	items, err := repo.ListPlans(context.Background(), "t-1")
	if err != nil {
		t.Fatalf("ListPlans: %v", err)
	}
	if len(items[0].WarnThresholds) != 3 ||
		items[0].WarnThresholds[0] != 0 || items[0].WarnThresholds[1] != 42 || items[0].WarnThresholds[2] != 100 {
		t.Fatalf("the malformed threshold list was not normalised: %+v", items[0].WarnThresholds)
	}
}

func TestUpdatePlanWritesEveryPolicyColumn(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	// The map is inserted in a deliberately different order from the whitelist,
	// which is the only thing that can prove the generated SQL is deterministic.
	mock.ExpectExec(normSQL(`UPDATE tenant_quota_plan SET max_cis = $1, soft_limit = $2, hard_limit = $3, over_limit_action = $4, warn_thresholds = $5, updated_at = NOW() WHERE id = $6 AND tenant_id = $7`)).
		WithArgs(20000, int64(4000), int64(5000), "warn", "50,80,95", "qp-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(normSQL(planList+" FROM tenant_quota_plan WHERE id = $1 AND tenant_id = $2")).
		WithArgs("qp-1", "t-1").
		WillReturnRows(planFixture(t, "50,80,95"))

	got, err := repo.UpdatePlan(context.Background(), "qp-1", "t-1", map[string]interface{}{
		"over_limit_action": "warn",
		"warn_thresholds":   "50,80,95",
		"hard_limit":        int64(5000),
		"soft_limit":        int64(4000),
		"max_cis":           20000,
	})
	if err != nil {
		t.Fatalf("UpdatePlan: %v", err)
	}
	if got == nil || got.SoftLimit != 4000 || got.HardLimit != 5000 {
		t.Fatalf("UpdatePlan did not return the stored row: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the update did not reach the database: %v", err)
	}
}

func TestUpdatePlanRejectsAColumnItWillNotWrite(t *testing.T) {
	db, _, seen := mockDBRecording(t)
	repo := NewRepository(db)

	got, err := repo.UpdatePlan(context.Background(), "qp-1", "t-1", map[string]interface{}{
		"tenant_id": "other-tenant",
	})
	if err == nil {
		t.Fatal("an unknown column must not be silently dropped")
	}
	if got != nil {
		t.Fatalf("a rejected update must not return a plan: %+v", got)
	}
	// A "no expectation" error from sqlmock would satisfy err != nil and leave
	// the guard untested, so pin the message the guard itself produces.
	if !strings.Contains(err.Error(), `column "tenant_id" is not updatable`) {
		t.Fatalf("error %q does not name the rejected column", err.Error())
	}
	if len(*seen) != 0 {
		t.Fatalf("a rejected update must not touch the database: %v", *seen)
	}
}

func TestUpdatePlanWithNoColumnsReturnsTheExistingRow(t *testing.T) {
	db, mock, seen := mockDBRecording(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL(planList+" FROM tenant_quota_plan WHERE id = $1 AND tenant_id = $2")).
		WithArgs("qp-1", "t-1").
		WillReturnRows(planFixture(t, "50,80,95"))

	got, err := repo.UpdatePlan(context.Background(), "qp-1", "t-1", map[string]interface{}{})
	if err != nil {
		t.Fatalf("UpdatePlan: %v", err)
	}
	if got == nil || got.ID != "qp-1" {
		t.Fatalf("UpdatePlan with no columns must return the existing row: %+v", got)
	}
	if len(*seen) != 1 || strings.HasPrefix((*seen)[0], "UPDATE ") {
		t.Fatalf("an empty update must not issue an UPDATE: %v", *seen)
	}
}

func TestUpdatePlanReturnsAStatementFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("deadlock detected")

	mock.ExpectExec(normSQL(`UPDATE tenant_quota_plan SET name = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`)).
		WithArgs("Renamed", "qp-1", "t-1").WillReturnError(fail)

	got, err := repo.UpdatePlan(context.Background(), "qp-1", "t-1", map[string]interface{}{"name": "Renamed"})
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
	if got != nil {
		t.Fatalf("a failed update must not return a plan: %+v", got)
	}
}

func TestDeletePlanReportsWhetherARowWasRemoved(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL("DELETE FROM tenant_quota_plan WHERE id = $1 AND tenant_id = $2")).
		WithArgs("qp-1", "t-1").WillReturnResult(sqlmock.NewResult(0, 1))
	if deleted, err := repo.DeletePlan(context.Background(), "qp-1", "t-1"); err != nil || !deleted {
		t.Fatalf("DeletePlan reported deleted=%v err=%v for a row that existed", deleted, err)
	}

	mock.ExpectExec(normSQL("DELETE FROM tenant_quota_plan WHERE id = $1 AND tenant_id = $2")).
		WithArgs("qp-404", "t-1").WillReturnResult(sqlmock.NewResult(0, 0))
	if deleted, err := repo.DeletePlan(context.Background(), "qp-404", "t-1"); err != nil || deleted {
		t.Fatalf("DeletePlan reported deleted=%v err=%v for a row that did not exist", deleted, err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the delete did not reach the database: %v", err)
	}
}

func TestDeletePlanReturnsAnExecFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("deadlock detected")
	mock.ExpectExec(normSQL("DELETE FROM tenant_quota_plan WHERE id = $1 AND tenant_id = $2")).
		WithArgs("qp-1", "t-1").WillReturnError(fail)

	deleted, err := repo.DeletePlan(context.Background(), "qp-1", "t-1")
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
	if deleted {
		t.Fatal("a failed delete must not report success")
	}
}

// A driver that fails to report a row count used to be discarded, which turned
// a real statement failure into "not deleted" and made the handler answer 404.
type failingRowsResult struct{}

func (failingRowsResult) LastInsertId() (int64, error) { return 0, nil }
func (failingRowsResult) RowsAffected() (int64, error) {
	return 0, errors.New("counting rows failed")
}

func TestDeletePlanReportsARowCountFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL("DELETE FROM tenant_quota_plan WHERE id = $1 AND tenant_id = $2")).
		WithArgs("qp-1", "t-1").WillReturnResult(failingRowsResult{})

	deleted, err := repo.DeletePlan(context.Background(), "qp-1", "t-1")
	if err == nil {
		t.Fatal("a row-count failure must be reported, not discarded")
	}
	if deleted {
		t.Fatal("a row-count failure must not report success")
	}
	if !strings.Contains(err.Error(), "counting deleted quota plans") ||
		!strings.Contains(err.Error(), "counting rows failed") {
		t.Fatalf("error %q does not name the failing row count", err.Error())
	}
}

// Absent is not failed. handler.GetUsage has an explicit "if u == nil" branch
// that answers with currentValue 0, and both quota checks guard "if usage !=
// nil", so nil is the documented answer for a tenant that has no usage row.
// Returning sql.ErrNoRows made POST /check and /check-with-policy 500 for
// every fresh tenant.
func TestGetUsageReturnsNilForAnAbsentRow(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectQuery(normSQL(usageList+" FROM tenant_quota_usage WHERE tenant_id = $1 AND metric = $2 ORDER BY window_start DESC LIMIT 1")).
		WithArgs("t-1", "cis").WillReturnError(sql.ErrNoRows)

	got, err := repo.GetUsage(context.Background(), "t-1", "cis")
	if err != nil {
		t.Fatalf("an absent usage row is not an error: %v", err)
	}
	if got != nil {
		t.Fatalf("an absent usage row must return nil, got %+v", got)
	}
}

func TestGetUsageReturnsAStatementFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("deadlock detected")

	mock.ExpectQuery(normSQL(usageList+" FROM tenant_quota_usage WHERE tenant_id = $1 AND metric = $2 ORDER BY window_start DESC LIMIT 1")).
		WithArgs("t-1", "cis").WillReturnError(fail)

	got, err := repo.GetUsage(context.Background(), "t-1", "cis")
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
	if got != nil {
		t.Fatalf("a failed read must not return usage: %+v", got)
	}
}

// id is VARCHAR(36) NOT NULL PRIMARY KEY, so the pre-R43 increment inserted an
// empty ID and the first increment per (tenant, metric) always died.
func TestIncrementUsageCreatesARowWithAnID(t *testing.T) {
	db, mock, seen := mockDBRecording(t)
	repo := NewRepository(db)
	resetAt := time.Date(2026, 1, 3, 3, 4, 5, 0, time.UTC)

	mock.ExpectQuery(normSQL(usageList+" FROM tenant_quota_usage WHERE tenant_id = $1 AND metric = $2 ORDER BY window_start DESC LIMIT 1")).
		WithArgs("t-1", "cis").WillReturnError(sql.ErrNoRows)
	mock.ExpectExec(normSQL(`INSERT INTO tenant_quota_usage (id, tenant_id, metric, current_value, peak_value, window_start, window_end, reset_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`)).
		WithArgs(sqlmock.AnyArg(), "t-1", "cis", int64(150), int64(150),
			sqlmock.AnyArg(), sqlmock.AnyArg(), resetAt, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	got, err := repo.IncrementUsage(context.Background(), "t-1", "cis", 150, resetAt)
	if err != nil {
		t.Fatalf("IncrementUsage: %v", err)
	}
	if got == nil {
		t.Fatal("IncrementUsage must return the new row")
	}
	if got.ID == "" {
		t.Fatal("the new usage row has no ID, so the NOT NULL primary key fails")
	}
	if got.CurrentValue != 150 || got.PeakValue != 150 || got.Metric != "cis" {
		t.Fatalf("unexpected new row: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the insert did not reach the database: %v", err)
	}
	if len(*seen) != 2 {
		t.Fatalf("a fresh increment issued %d statements: %v", len(*seen), *seen)
	}
}

// A statement failure must not be mistaken for an absent row, otherwise a
// failed read races to INSERT a second row for the same (tenant, metric).
func TestIncrementUsagePropagatesALookupFailure(t *testing.T) {
	db, mock, seen := mockDBRecording(t)
	repo := NewRepository(db)
	fail := errors.New("deadlock detected")

	mock.ExpectQuery(normSQL(usageList+" FROM tenant_quota_usage WHERE tenant_id = $1 AND metric = $2 ORDER BY window_start DESC LIMIT 1")).
		WithArgs("t-1", "cis").WillReturnError(fail)

	got, err := repo.IncrementUsage(context.Background(), "t-1", "cis", 150, time.Now())
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
	if got != nil {
		t.Fatalf("a failed lookup must not return usage: %+v", got)
	}
	if len(*seen) != 1 {
		t.Fatalf("a failed lookup must not attempt an INSERT: %v", *seen)
	}
}

func TestIncrementUsageAddsToAnExistingRowWithoutTouchingAPeak(t *testing.T) {
	db, mock, seen := mockDBRecording(t)
	repo := NewRepository(db)
	resetAt := time.Date(2026, 1, 3, 3, 4, 5, 0, time.UTC)
	windowStart := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	windowEnd := time.Date(2026, 1, 2, 4, 4, 5, 0, time.UTC)

	mock.ExpectQuery(normSQL(usageList+" FROM tenant_quota_usage WHERE tenant_id = $1 AND metric = $2 ORDER BY window_start DESC LIMIT 1")).
		WithArgs("t-1", "cis").
		WillReturnRows(sqlmock.NewRows(usageRowNames).AddRow(
			"qu-1", "t-1", "cis", int64(100), int64(200), windowStart, windowEnd, resetAt, windowStart))
	// 100 + 50 = 150, still below the peak of 200, so the peak must not move.
	mock.ExpectExec(normSQL(`UPDATE tenant_quota_usage SET current_value = $1, peak_value = $2, window_start = $3, window_end = $4, reset_at = $5, updated_at = $6 WHERE tenant_id = $7 AND metric = $8`)).
		WithArgs(int64(150), int64(200), windowStart, windowEnd, resetAt, sqlmock.AnyArg(), "t-1", "cis").
		WillReturnResult(sqlmock.NewResult(0, 1))

	got, err := repo.IncrementUsage(context.Background(), "t-1", "cis", 50, resetAt)
	if err != nil {
		t.Fatalf("IncrementUsage: %v", err)
	}
	if got == nil || got.CurrentValue != 150 || got.PeakValue != 200 || got.ID != "qu-1" {
		t.Fatalf("the existing row was not updated correctly: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the update did not reach the database: %v", err)
	}
	if len(*seen) != 2 {
		t.Fatalf("an existing-row increment issued %d statements: %v", len(*seen), *seen)
	}
}

func TestIncrementUsageRaisesThePeakWhenCurrentValueOvertakesIt(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	resetAt := time.Date(2026, 1, 3, 3, 4, 5, 0, time.UTC)
	windowStart := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	windowEnd := time.Date(2026, 1, 2, 4, 4, 5, 0, time.UTC)

	mock.ExpectQuery(normSQL(usageList+" FROM tenant_quota_usage WHERE tenant_id = $1 AND metric = $2 ORDER BY window_start DESC LIMIT 1")).
		WithArgs("t-1", "cis").
		WillReturnRows(sqlmock.NewRows(usageRowNames).AddRow(
			"qu-1", "t-1", "cis", int64(100), int64(90), windowStart, windowEnd, resetAt, windowStart))
	mock.ExpectExec(normSQL(`UPDATE tenant_quota_usage SET current_value = $1, peak_value = $2, window_start = $3, window_end = $4, reset_at = $5, updated_at = $6 WHERE tenant_id = $7 AND metric = $8`)).
		WithArgs(int64(150), int64(150), windowStart, windowEnd, resetAt, sqlmock.AnyArg(), "t-1", "cis").
		WillReturnResult(sqlmock.NewResult(0, 1))

	got, err := repo.IncrementUsage(context.Background(), "t-1", "cis", 50, resetAt)
	if err != nil {
		t.Fatalf("IncrementUsage: %v", err)
	}
	if got == nil || got.CurrentValue != 150 || got.PeakValue != 150 {
		t.Fatalf("the peak was not raised: %+v", got)
	}
}

func TestIncrementUsageReturnsAnUpdateFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("deadlock detected")
	windowStart := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	windowEnd := time.Date(2026, 1, 2, 4, 4, 5, 0, time.UTC)
	resetAt := time.Date(2026, 1, 3, 3, 4, 5, 0, time.UTC)

	mock.ExpectQuery(normSQL(usageList+" FROM tenant_quota_usage WHERE tenant_id = $1 AND metric = $2 ORDER BY window_start DESC LIMIT 1")).
		WithArgs("t-1", "cis").
		WillReturnRows(sqlmock.NewRows(usageRowNames).AddRow(
			"qu-1", "t-1", "cis", int64(100), int64(200), windowStart, windowEnd, resetAt, windowStart))
	mock.ExpectExec(normSQL(`UPDATE tenant_quota_usage SET current_value = $1, peak_value = $2, window_start = $3, window_end = $4, reset_at = $5, updated_at = $6 WHERE tenant_id = $7 AND metric = $8`)).
		WithArgs(int64(150), int64(200), windowStart, windowEnd, resetAt, sqlmock.AnyArg(), "t-1", "cis").
		WillReturnError(fail)

	got, err := repo.IncrementUsage(context.Background(), "t-1", "cis", 50, resetAt)
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
	if got != nil {
		t.Fatalf("a failed update must not return usage: %+v", got)
	}
}

func TestIncrementUsageReturnsAnInsertFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("deadlock detected")

	mock.ExpectQuery(normSQL(usageList+" FROM tenant_quota_usage WHERE tenant_id = $1 AND metric = $2 ORDER BY window_start DESC LIMIT 1")).
		WithArgs("t-1", "cis").WillReturnError(sql.ErrNoRows)
	mock.ExpectExec(normSQL(usageCreate)).
		WithArgs(sqlmock.AnyArg(), "t-1", "cis", int64(150), int64(150),
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnError(fail)

	got, err := repo.IncrementUsage(context.Background(), "t-1", "cis", 150, time.Now())
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
	if got != nil {
		t.Fatalf("a failed insert must not return usage: %+v", got)
	}
}

func TestListUsageUsesAnExplicitColumnList(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	now := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)

	mock.ExpectQuery(normSQL(usageList + " FROM tenant_quota_usage WHERE tenant_id = $1 ORDER BY metric")).
		WithArgs("t-1").
		WillReturnRows(sqlmock.NewRows(usageRowNames).AddRow(
			"qu-1", "t-1", "cis", int64(150), int64(200), now, now, now, now))

	items, err := repo.ListUsage(context.Background(), "t-1")
	if err != nil {
		t.Fatalf("ListUsage: %v", err)
	}
	if len(items) != 1 || items[0].ID != "qu-1" || items[0].PeakValue != 200 {
		t.Fatalf("unexpected rows: %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ListUsage did not issue the expected statement: %v", err)
	}
}

func TestListUsageReturnsAStatementFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("deadlock detected")
	mock.ExpectQuery(normSQL(usageList + " FROM tenant_quota_usage WHERE tenant_id = $1 ORDER BY metric")).
		WithArgs("t-1").WillReturnError(fail)

	items, err := repo.ListUsage(context.Background(), "t-1")
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
	if items != nil {
		t.Fatalf("a failed read must not return usage: %+v", items)
	}
}

func TestResetUsageClearsCurrentValue(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)

	mock.ExpectExec(normSQL("UPDATE tenant_quota_usage SET current_value = 0, updated_at = NOW() WHERE tenant_id = $1")).
		WithArgs("t-1").WillReturnResult(sqlmock.NewResult(0, 4))

	if err := repo.ResetUsage(context.Background(), "t-1"); err != nil {
		t.Fatalf("ResetUsage: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the reset did not reach the database: %v", err)
	}
}

func TestResetUsageReturnsAStatementFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("deadlock detected")
	mock.ExpectExec(normSQL("UPDATE tenant_quota_usage SET current_value = 0, updated_at = NOW() WHERE tenant_id = $1")).
		WithArgs("t-1").WillReturnError(fail)

	if err := repo.ResetUsage(context.Background(), "t-1"); !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
}

func TestCreateAlertBindsEveryColumn(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	now := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)

	mock.ExpectExec(normSQL(`INSERT INTO tenant_quota_alert (id, tenant_id, metric, current_value, limit_value, usage_pct, alert_level, notified_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`)).
		WithArgs("qa-1", "t-1", "cis", int64(4750), int64(5000), float64(95.0), "warning", now).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.CreateAlert(context.Background(), &models.QuotaAlert{
		ID: "qa-1", TenantID: "t-1", Metric: "cis", CurrentValue: 4750,
		LimitValue: 5000, UsagePct: 95.0, AlertLevel: "warning", NotifiedAt: now,
	}); err != nil {
		t.Fatalf("CreateAlert: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the insert did not reach the database: %v", err)
	}
}

// usage_pct is DECIMAL(5,2), which lib/pq hands back as bytes. Scanning that
// into float64 goes through database/sql's asString path rather than a direct
// assignment, so the fixture uses bytes rather than a float to prove it.
func TestListAlertsScansADecimalUsagePct(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	now := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)

	mock.ExpectQuery(normSQL(alertList + " FROM tenant_quota_alert WHERE tenant_id = $1 ORDER BY notified_at DESC")).
		WithArgs("t-1").
		WillReturnRows(sqlmock.NewRows(alertRowNames).AddRow(
			"qa-1", "t-1", "cis", int64(4750), int64(5000), []byte("95.00"), "warning", now))

	items, err := repo.ListAlerts(context.Background(), "t-1")
	if err != nil {
		t.Fatalf("ListAlerts: %v", err)
	}
	if len(items) != 1 || items[0].UsagePct != 95.0 || items[0].AlertLevel != "warning" {
		t.Fatalf("unexpected rows: %+v", items)
	}
}

func TestListAlertsReturnsAStatementFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("deadlock detected")
	mock.ExpectQuery(normSQL(alertList + " FROM tenant_quota_alert WHERE tenant_id = $1 ORDER BY notified_at DESC")).
		WithArgs("t-1").WillReturnError(fail)

	items, err := repo.ListAlerts(context.Background(), "t-1")
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
	if items != nil {
		t.Fatalf("a failed read must not return alerts: %+v", items)
	}
}

func TestCreateAlertReturnsAStatementFailure(t *testing.T) {
	db, mock := mockDB(t)
	repo := NewRepository(db)
	fail := errors.New("deadlock detected")
	now := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	mock.ExpectExec(normSQL(alertCreate)).
		WithArgs("qa-1", "t-1", "cis", int64(4750), int64(5000), float64(95.0), "warning", now).
		WillReturnError(fail)

	err := repo.CreateAlert(context.Background(), &models.QuotaAlert{
		ID: "qa-1", TenantID: "t-1", Metric: "cis", CurrentValue: 4750,
		LimitValue: 5000, UsagePct: 95.0, AlertLevel: "warning", NotifiedAt: now,
	})
	if !errors.Is(err, fail) {
		t.Fatalf("error %q is not the statement failure", err)
	}
}

func TestEncodeThresholdsRoundTripsThroughDecode(t *testing.T) {
	cases := map[string][]int{
		"":                nil,
		"50,80,95":        []int{50, 80, 95},
		"95,50,80":        []int{50, 80, 95},
		"80,80,95":        []int{80, 95},
		"-5,150,42":       []int{0, 42, 100},
		"not-a-number,42": []int{42},
		" 42 , 43 ":       []int{42, 43},
	}
	for raw, want := range cases {
		if got := decodeThresholds(raw); !sameInts(got, want) {
			t.Errorf("decodeThresholds(%q) = %+v, want %+v", raw, got, want)
		}
	}
	for _, in := range [][]int{nil, {}, {50, 80, 95}, {-5, 150}} {
		if out := encodeThresholds(in); out != joinExpected(in) {
			t.Errorf("encodeThresholds(%+v) = %q, want %q", in, out, joinExpected(in))
		}
	}
}

func sameInts(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func joinExpected(in []int) string {
	parts := make([]string, 0, len(in))
	for _, v := range in {
		parts = append(parts, fmt.Sprintf("%d", v))
	}
	return strings.Join(parts, ",")
}
