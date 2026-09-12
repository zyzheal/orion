package repository

import (
	"context"
	"database/sql/driver"
	"errors"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/performance/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// Round 18 made every call in this file fail at runtime with
// `relation does not exist`: three statements targeted performance_baselines,
// performance_evaluations and performance_profiles while migration 152 creates
// them under bare names, and four targeted tables that no migration created at
// all. None of that is visible from the build, which is what this file pins.
//
// The expectations below use regexp matchers that include the table name with
// its preceding "FROM "/"INSERT INTO " qualifier, so a regression back to
// performance_baselines does not match and sqlmock reports the call as
// unexpected. Assertions are anchored on args, not on the returned row alone:
// sqlmock's WithArgs compares the bound values, so a wrong column binding
// fails the test rather than passing through as an empty result.

func newMockRepo(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

func baselineRows(add ...[]driver.Value) *sqlmock.Rows {
	rows := sqlmock.NewRows([]string{
		"id", "tenant_id", "service_name", "metric", "threshold", "window_days", "status", "created_at",
	})
	for _, r := range add {
		rows.AddRow(r...)
	}
	return rows
}

func TestCreateBaseline_InsertsIntoTheBareTableNameFromMigration152(t *testing.T) {
	mock, repo := newMockRepo(t)
	// performance_baselines was the pre-Round-18 name. This expectation fails
	// if it comes back, because sqlmock rejects the unexpected statement.
	mock.ExpectExec(`INSERT INTO baselines \(id, tenant_id, service_name, metric, threshold, window_days, status, created_at\)`).
		WithArgs(sqlmock.AnyArg(), "t1", "checkout", "p95_latency_ms", 100.0, 30,
			models.StatusActive, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery(`FROM baselines WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs(sqlmock.AnyArg(), "t1").
		WillReturnRows(baselineRows([]driver.Value{"b-1", "t1", "checkout", "p95_latency_ms", 100.0, 30, models.StatusActive, time.Now().UTC()}))

	b, err := repo.CreateBaseline(context.Background(), "t1", &models.Baseline{
		ServiceName: "checkout",
		Metric:      "p95_latency_ms",
		Threshold:   100.0,
		WindowDays:  30,
	})
	if err != nil {
		t.Fatalf("CreateBaseline: %v", err)
	}
	if b == nil || b.ID == "" {
		t.Fatalf("CreateBaseline returned %+v, want the row it inserted", b)
	}
	// Status used to be written as the zero value, which is indistinguishable
	// from a baseline nobody activated. Asserting the bound value is what makes
	// that observable.
	if b.Status != models.StatusActive {
		t.Errorf("status = %q, want %q", b.Status, models.StatusActive)
	}
	if b.WindowDays != 30 {
		t.Errorf("window_days = %d, want the submitted 30", b.WindowDays)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the INSERT did not reach the bare baselines table: %v", err)
	}
}

func TestCreateBaseline_DefaultsWindowDaysToSeven(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`INSERT INTO baselines `).
		WithArgs(sqlmock.AnyArg(), "t1", "checkout", "p95_latency_ms", 50.0, 7,
			models.StatusActive, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery(`FROM baselines WHERE id=\$1`).
		WillReturnRows(baselineRows([]driver.Value{"b-1", "t1", "checkout", "p95_latency_ms", 50.0, 7, models.StatusActive, time.Now().UTC()}))

	b, err := repo.CreateBaseline(context.Background(), "t1", &models.Baseline{
		ServiceName: "checkout",
		Metric:      "p95_latency_ms",
		Threshold:   50.0,
	})
	if err != nil {
		t.Fatalf("CreateBaseline: %v", err)
	}
	if b.WindowDays != 7 {
		t.Errorf("window_days = %d, want the default 7", b.WindowDays)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("window_days default never reached the statement: %v", err)
	}
}

func TestListBaselines_SelectsFromTheBareTableName(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(`FROM baselines WHERE tenant_id=\$1 ORDER BY created_at DESC`).
		WithArgs("t1").
		WillReturnRows(baselineRows(
			[]driver.Value{"b-2", "t1", "checkout", "p95_latency_ms", 100.0, 7, models.StatusActive, time.Now().UTC()},
			[]driver.Value{"b-1", "t1", "checkout", "error_rate", 0.01, 7, models.StatusActive, time.Now().UTC()},
		))

	baselines, err := repo.ListBaselines(context.Background(), "t1")
	if err != nil {
		t.Fatalf("ListBaselines: %v", err)
	}
	if len(baselines) != 2 {
		t.Fatalf("got %d baselines, want 2", len(baselines))
	}
	if baselines[0].ID != "b-2" || baselines[1].Metric != "error_rate" {
		t.Errorf("rows = %+v, want both rows in statement order", baselines)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the query did not read the bare baselines table: %v", err)
	}
}

func TestListBaselines_EmptyTableReturnsAnEmptySlice(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(`FROM baselines WHERE tenant_id=\$1`).
		WillReturnRows(baselineRows())

	baselines, err := repo.ListBaselines(context.Background(), "t1")
	if err != nil {
		t.Fatalf("ListBaselines: %v", err)
	}
	if baselines == nil {
		t.Fatal("ListBaselines returned nil, want an empty slice for a JSON [] reply")
	}
	if len(baselines) != 0 {
		t.Errorf("got %d baselines, want 0", len(baselines))
	}
}

func TestGetBaselineByID_MapsNoRowsToSentinelNotFound(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(`FROM baselines WHERE id=\$1 AND tenant_id=\$2`).
		WithArgs("missing", "t1").
		WillReturnRows(baselineRows())

	b, err := repo.GetBaselineByID(context.Background(), "missing", "t1")
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("err = %v, want errors.Is(err, sentinel.NotFound)", err)
	}
	if b != nil {
		t.Errorf("returned %+v, want nil with the not-found error", b)
	}
}

func TestGetEvaluationHistory_KeysByBaselineIDAndTenantID(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(`FROM evaluations WHERE baseline_id=\$1 AND tenant_id=\$2 ORDER BY timestamp DESC`).
		WithArgs("b-1", "t1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "baseline_id", "value", "status", "timestamp", "created_at",
		}).AddRow("e-1", "t1", "b-1", 42.5, models.EvalStatusOK, time.Now().UTC(), time.Now().UTC()))

	evaluations, err := repo.GetEvaluationHistory(context.Background(), "b-1", "t1")
	if err != nil {
		t.Fatalf("GetEvaluationHistory: %v", err)
	}
	if len(evaluations) != 1 || evaluations[0].ID != "e-1" || evaluations[0].BaselineID != "b-1" {
		t.Fatalf("evaluations = %+v, want the row for b-1", evaluations)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("history was not read from the bare evaluations table: %v", err)
	}
}

func TestRecordEvaluation_BindsTheBaselineIDItWasGiven(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`INSERT INTO evaluations \(id, tenant_id, baseline_id, value, status, timestamp, created_at\)`).
		// The pre-Round-18 service called this with an empty baseline_id, which
		// orphaned the row: GetEvaluationHistory filters by baseline_id and so
		// could never return it. The literal below fails if that returns.
		WithArgs(sqlmock.AnyArg(), "t1", "b-123", 42.5, models.EvalStatusOK,
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	e, err := repo.RecordEvaluation(context.Background(), "t1", "b-123", 42.5, models.EvalStatusOK)
	if err != nil {
		t.Fatalf("RecordEvaluation: %v", err)
	}
	if e == nil || e.ID == "" || e.BaselineID != "b-123" || e.Value != 42.5 {
		t.Fatalf("RecordEvaluation returned %+v, want the row it inserted", e)
	}
	if e.Timestamp.IsZero() {
		t.Error("Timestamp is zero: the reply cannot be correlated to a point in time")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the evaluation was not bound to baseline b-123: %v", err)
	}
}

func TestProfileService_ReadsTheBareProfilesTableAndYieldsNilOnNoRows(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(`FROM profiles WHERE tenant_id=\$1 AND service_name=\$2 ORDER BY timestamp DESC LIMIT 1`).
		WithArgs("t1", "checkout").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "service_name", "timestamp", "created_at",
		}).AddRow("p-1", "t1", "checkout", time.Now().UTC(), time.Now().UTC()))

	p, err := repo.ProfileService(context.Background(), "t1", "checkout")
	if err != nil {
		t.Fatalf("ProfileService: %v", err)
	}
	if p == nil || p.ID != "p-1" {
		t.Fatalf("ProfileService returned %+v, want the stored profile", p)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the profile was not read from the bare profiles table: %v", err)
	}
}

func TestProfileService_MissingProfileIsNilNotAnError(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(`FROM profiles WHERE tenant_id=\$1`).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "service_name", "timestamp", "created_at",
		}))

	p, err := repo.ProfileService(context.Background(), "t1", "ghost")
	if err != nil {
		t.Fatalf("ProfileService: %v", err)
	}
	if p != nil {
		t.Errorf("ProfileService returned %+v, want nil: the handler turns nil into a 404", p)
	}
}

func TestGetBottlenecks_ScopesByServiceNameNotByProfileID(t *testing.T) {
	mock, repo := newMockRepo(t)
	// The pre-Round-18 query bound the :serviceName path value into profile_id,
	// a UUID column, so the WHERE clause could never match and the endpoint was
	// structurally incapable of returning a row. This expectation matches only
	// the service_name-scoped form; sqlmock rejects the profile_id form as an
	// unexpected call, which is the assertion.
	mock.ExpectQuery(`FROM performance_bottlenecks WHERE service_name=\$1 AND tenant_id=\$2 ORDER BY score DESC`).
		WithArgs("checkout", "t1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "profile_id", "service_name", "type", "description", "score",
		}).AddRow("bn-1", "p-1", "checkout", "cpu", "hot loop", 8.5))

	bottlenecks, err := repo.GetBottlenecks(context.Background(), "t1", "checkout")
	if err != nil {
		t.Fatalf("GetBottlenecks: %v", err)
	}
	if len(bottlenecks) != 1 || bottlenecks[0].ServiceName != "checkout" {
		t.Fatalf("bottlenecks = %+v, want the row for checkout", bottlenecks)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("bottlenecks were not scoped by service_name: %v", err)
	}
}

func TestGetSuggestions_ScopesByServiceNameNotByProfileID(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(`FROM performance_suggestions WHERE service_name=\$1 AND tenant_id=\$2 ORDER BY priority`).
		WithArgs("checkout", "t1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "service_name", "type", "description", "priority",
		}).AddRow("sg-1", "checkout", "cache", "cache hot keys", "high"))

	suggestions, err := repo.GetSuggestions(context.Background(), "t1", "checkout")
	if err != nil {
		t.Fatalf("GetSuggestions: %v", err)
	}
	if len(suggestions) != 1 || suggestions[0].Priority != "high" {
		t.Fatalf("suggestions = %+v, want the row for checkout", suggestions)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("suggestions were not scoped by service_name: %v", err)
	}
}

func TestDetectRegression_InsertsIntoThePrefixedTable(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`INSERT INTO performance_regressions `).
		WithArgs(sqlmock.AnyArg(), "t1", "checkout", "p95_latency_ms", 100.0, 150.0, 50.0,
			sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	result, err := repo.DetectRegression(context.Background(), "t1", &models.DetectRegressionRequest{
		ServiceName: "checkout",
		Metric:      "p95_latency_ms",
		Previous:    100.0,
		Current:     150.0,
	})
	if err != nil {
		t.Fatalf("DetectRegression: %v", err)
	}
	if result == nil || result.ID == "" || result.ChangePct != 50.0 {
		t.Fatalf("DetectRegression returned %+v, want the stored row with a 50%% change", result)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the regression was not persisted: %v", err)
	}
}

func TestDetectRegression_DividesByZeroWithoutNaN(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`INSERT INTO performance_regressions `).
		WithArgs(sqlmock.AnyArg(), "t1", "checkout", "error_rate", 0.0, 3.0, 0.0,
			sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	result, err := repo.DetectRegression(context.Background(), "t1", &models.DetectRegressionRequest{
		ServiceName: "checkout",
		Metric:      "error_rate",
		Previous:    0.0,
		Current:     3.0,
	})
	if err != nil {
		t.Fatalf("DetectRegression: %v", err)
	}
	if result.ChangePct != 0.0 {
		t.Errorf("change_pct = %v, want 0 when the baseline is zero", result.ChangePct)
	}
}

func TestRecordTestResult_ReturnsTheRowItInserted(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec(`INSERT INTO performance_test_results \(id, tenant_id, service_name, test_name, duration, status, timestamp\)`).
		WithArgs(sqlmock.AnyArg(), "t1", "checkout", "bench_read", 1234, "passed",
			sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	tr, err := repo.RecordTestResult(context.Background(), "t1", &models.TestResultRequest{
		ServiceName: "checkout",
		TestName:    "bench_read",
		Duration:    1234,
		Status:      "passed",
	})
	if err != nil {
		t.Fatalf("RecordTestResult: %v", err)
	}
	if tr == nil || tr.ID == "" || tr.TestName != "bench_read" || tr.Duration != 1234 {
		t.Fatalf("RecordTestResult returned %+v, want the stored row", tr)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the test result was not persisted: %v", err)
	}
}

// GetTestResults used to be `return []models.Baseline{}, nil` behind a comment
// saying it was simplified. This test fails against that stub twice over: the
// SELECT expectation is never consumed, and the wrong return type would not
// even compile.
func TestGetTestResults_ReadsTheRowsItWasWritten(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectQuery(`FROM performance_test_results WHERE tenant_id=\$1 AND service_name=\$2 ORDER BY timestamp DESC`).
		WithArgs("t1", "checkout").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "service_name", "test_name", "duration", "status", "timestamp",
		}).AddRow("tr-1", "t1", "checkout", "bench_read", 1234, "passed", time.Now().UTC()))

	results, err := repo.GetTestResults(context.Background(), "t1", "checkout")
	if err != nil {
		t.Fatalf("GetTestResults: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("got %d results, want 1: an empty list was the Round-17 stub", len(results))
	}
	if results[0].ID != "tr-1" || results[0].TestName != "bench_read" || results[0].Duration != 1234 {
		t.Errorf("results = %+v, want the row just recorded", results)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("GetTestResults never ran a SELECT: %v", err)
	}
}
