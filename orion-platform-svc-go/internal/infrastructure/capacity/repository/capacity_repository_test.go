package repository

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// All three List methods own the pagination clause. If any of them drops
// OFFSET or LIMIT the endpoint returns the whole table, which is the
// symptom-based signature of this defect family. Each test pins the clause and
// the bind order.
//
// The bind order matters: the clause is `OFFSET $2 LIMIT $3` but the args are
// passed `tenantID, offset, limit`. Swapping the last two is a silent
// misread - the query stays well-formed and Postgres stays happy, but
// page=3&page_size=20 starts at row 60 instead of row 40.
//
// QueryMatcherEqual is exact, so the strings below carry no escapes: a drift
// anywhere in the clause, including the missing ORDER BY that would make the
// window unstable, fails the match.

func newMockDB(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock, func()) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	return sqlx.NewDb(db, "sqlmock"), mock, func() { db.Close() }
}

func poolCols() []string {
	return []string{
		"id", "tenant_id", "name", "resource_type",
		"total_cpu", "total_memory", "used_cpu", "used_memory",
		"node_count", "labels", "created_at", "updated_at",
	}
}

func forecastCols() []string {
	return []string{
		"id", "tenant_id", "resource_type", "current_usage", "predicted",
		"threshold", "days_until_full", "recommendation", "forecast_date",
	}
}

func reportCols() []string {
	return []string{
		"id", "tenant_id", "title", "total_resources", "healthy_count",
		"warning_count", "critical_count", "overall_score",
		"alerts_snapshot", "forecasts_snapshot", "generated_at",
	}
}

func metricCols() []string {
	return []string{
		"id", "tenant_id", "resource_type", "resource_id", "metric_name",
		"current_value", "max_value", "unit", "utilization_percent", "recorded_at",
	}
}

func TestPoolRepositoryList_PaginatesAndBindsInClauseOrder(t *testing.T) {
	db, mock, close := newMockDB(t)
	defer close()
	r := NewPoolRepository(db)

	now := time.Now().UTC()
	mock.ExpectQuery("SELECT * FROM resource_pools WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 20, 25).
		WillReturnRows(sqlmock.NewRows(poolCols()).
			AddRow("pool-1", "tenant-1", "k8s-prod", "k8s",
				64.0, 256.0, 32.0, 128.0, 8, []byte("{}"), now, now))

	items, err := r.List(context.Background(), "tenant-1", 20, 25)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("got %d rows, want 1", len(items))
	}
	if items[0].Name != "k8s-prod" || items[0].NodeCount != 8 {
		t.Errorf("row = %+v", items[0])
	}
	if items[0].Labels == nil {
		t.Errorf("labels did not scan into the JSONB field")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("expectations: %v", err)
	}
}

func TestPoolRepositoryList_EmptyTableYieldsZeroRows(t *testing.T) {
	db, mock, close := newMockDB(t)
	defer close()
	r := NewPoolRepository(db)

	mock.ExpectQuery("SELECT * FROM resource_pools WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 0, 20).
		WillReturnRows(sqlmock.NewRows(poolCols()))

	items, err := r.List(context.Background(), "tenant-1", 0, 20)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	// The repository declares `var items []models.ResourcePool`, so an empty
	// table comes back nil. Callers must not have to tell that apart.
	if len(items) != 0 {
		t.Errorf("len = %d, want 0", len(items))
	}
}

func TestPoolRepositoryList_PropagatesTheDriverError(t *testing.T) {
	db, mock, close := newMockDB(t)
	defer close()
	r := NewPoolRepository(db)

	mock.ExpectQuery("SELECT * FROM resource_pools WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 0, 20).
		WillReturnError(errors.New("boom"))

	items, err := r.List(context.Background(), "tenant-1", 0, 20)
	if err == nil {
		t.Fatalf("want error, got %+v", items)
	}
}

func TestForecastRepositoryList_PaginatesAndBindsInClauseOrder(t *testing.T) {
	db, mock, close := newMockDB(t)
	defer close()
	r := NewForecastRepository(db)

	now := time.Now().UTC()
	mock.ExpectQuery("SELECT * FROM capacity_forecasts WHERE tenant_id=$1 ORDER BY forecast_date DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 40, 20).
		WillReturnRows(sqlmock.NewRows(forecastCols()).
			AddRow("fc-1", "tenant-1", "cpu", 65.5, 82.3, 80.0, 14, "scale up", now))

	items, err := r.List(context.Background(), "tenant-1", 40, 20)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("got %d rows, want 1", len(items))
	}
	if items[0].DaysUntilFull != 14 || items[0].Predicted != 82.3 {
		t.Errorf("row = %+v", items[0])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("expectations: %v", err)
	}
}

func TestReportRepositoryList_PaginatesAndBindsInClauseOrder(t *testing.T) {
	db, mock, close := newMockDB(t)
	defer close()
	r := NewReportRepository(db)

	now := time.Now().UTC()
	mock.ExpectQuery("SELECT * FROM capacity_reports WHERE tenant_id=$1 ORDER BY generated_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 0, 100).
		WillReturnRows(sqlmock.NewRows(reportCols()).
			AddRow("rep-1", "tenant-1", "monthly", 50, 40, 8, 2, 78,
				[]byte("{}"), []byte("{}"), now))

	items, err := r.List(context.Background(), "tenant-1", 0, 100)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("got %d rows, want 1", len(items))
	}
	if items[0].Title != "monthly" || items[0].OverallScore != 78 {
		t.Errorf("row = %+v", items[0])
	}
	if items[0].AlertsSnapshot == nil || items[0].ForecastsSnapshot == nil {
		t.Errorf("the two JSONB snapshot fields did not scan")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("expectations: %v", err)
	}
}

// The tenant filter on the metric and alert lists. A bare `WHERE tenant_id=$1`
// dropping out of either is a cross-tenant read.
func TestMetricRepositoryList_KeepsTheTenantFilter(t *testing.T) {
	db, mock, close := newMockDB(t)
	defer close()
	r := NewMetricRepository(db)

	now := time.Now().UTC()
	mock.ExpectQuery("SELECT * FROM capacity_metrics WHERE tenant_id=$1 ORDER BY recorded_at DESC").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows(metricCols()).
			AddRow("m-1", "tenant-1", "cpu", "node-1", "usage", 80.0, 100.0, "%", 80.0, now))

	items, err := r.List(context.Background(), "tenant-1", "", "")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(items) != 1 || items[0].MetricName != "usage" {
		t.Fatalf("rows = %+v", items)
	}
}

// Both filters on: three placeholders, three args, in the order the clause
// refers to them.
func TestMetricRepositoryList_AppendsOneArgPerPlaceholder(t *testing.T) {
	db, mock, close := newMockDB(t)
	defer close()
	r := NewMetricRepository(db)

	mock.ExpectQuery("SELECT * FROM capacity_metrics WHERE tenant_id=$1 AND resource_type=$2 AND metric_name=$3 ORDER BY recorded_at DESC").
		WithArgs("tenant-1", "cpu", "usage").
		WillReturnRows(sqlmock.NewRows(metricCols()))

	items, err := r.List(context.Background(), "tenant-1", "cpu", "usage")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("len = %d, want 0", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("expectations: %v", err)
	}
}

func TestAlertRepositoryList_AppendsOneArgPerPlaceholder(t *testing.T) {
	db, mock, close := newMockDB(t)
	defer close()
	r := NewAlertRepository(db)

	mock.ExpectQuery("SELECT * FROM capacity_alerts WHERE tenant_id=$1 AND severity=$2 ORDER BY created_at DESC").
		WithArgs("tenant-1", "critical").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "resource_id", "resource_type", "metric_name",
			"current_utilization", "threshold", "severity", "message", "created_at",
		}))

	items, err := r.List(context.Background(), "tenant-1", "critical")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("len = %d, want 0", len(items))
	}
}

func TestPolicyRepositoryList_KeepsTheTenantFilter(t *testing.T) {
	db, mock, close := newMockDB(t)
	defer close()
	r := NewPolicyRepository(db)

	now := time.Now().UTC()
	mock.ExpectQuery("SELECT * FROM scaling_policies WHERE tenant_id=$1 ORDER BY created_at DESC").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "resource_type", "min_replicas", "max_replicas",
			"scale_up_threshold", "scale_down_threshold", "cooldown_sec", "enabled", "created_at",
		}).AddRow("pol-1", "tenant-1", "cpu-scale", "cpu", 2, 20, 80.0, 30.0, 300, true, now))

	items, err := r.List(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(items) != 1 || items[0].Name != "cpu-scale" {
		t.Fatalf("rows = %+v", items)
	}
}

// The tenant filter on Count is what the pools-count endpoint reports.
func TestPoolRepositoryCount_BindsTheTenant(t *testing.T) {
	db, mock, close := newMockDB(t)
	defer close()
	r := NewPoolRepository(db)

	mock.ExpectQuery("SELECT COUNT(*) FROM resource_pools WHERE tenant_id=$1").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(17))

	n, err := r.Count(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("Count: %v", err)
	}
	if n != 17 {
		t.Errorf("count = %d, want 17", n)
	}
}
