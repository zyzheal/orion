package service

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"orion/platform-svc-go/internal/infrastructure/capacity/repository"
)

func TestErrorConstants(t *testing.T) {
	if ErrPoolNotFound.Error() != "resource pool not found" {
		t.Errorf("unexpected ErrPoolNotFound: %s", ErrPoolNotFound.Error())
	}
	if ErrPolicyNotFound.Error() != "scaling policy not found" {
		t.Errorf("unexpected ErrPolicyNotFound: %s", ErrPolicyNotFound.Error())
	}
	if ErrForecastNotFound.Error() != "capacity forecast not found" {
		t.Errorf("unexpected ErrForecastNotFound: %s", ErrForecastNotFound.Error())
	}
}

// The handler owns the page arithmetic for this module: it floors both inputs,
// caps the size at 100, and derives the offset. The service must pass both
// through untouched, and the repository must bind both. These three tests
// close that chain at the seam between service and repository, over a real
// Service and real repositories driven by sqlmock.
//
// WithArgs pins the bind order too: the clause is `OFFSET $2 LIMIT $3` and the
// args go out `tenantID, offset, limit`, so offset and limit arriving swapped
// is caught here rather than by a reader who notices page 3 showing page 4.

func newTestService(t *testing.T) (*Service, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	sdb := sqlx.NewDb(db, "sqlmock")
	t.Cleanup(func() { db.Close() })
	svc := NewService(
		repository.NewPoolRepository(sdb),
		repository.NewForecastRepository(sdb),
		repository.NewPolicyRepository(sdb),
		repository.NewMetricRepository(sdb),
		repository.NewAlertRepository(sdb),
		repository.NewReportRepository(sdb),
	)
	return svc, mock
}

func TestServiceListPools_ForwardsOffsetAndLimitUntouched(t *testing.T) {
	svc, mock := newTestService(t)

	mock.ExpectQuery("SELECT * FROM resource_pools WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 200, 100).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "resource_type",
			"total_cpu", "total_memory", "used_cpu", "used_memory",
			"node_count", "labels", "created_at", "updated_at",
		}))

	items, err := svc.ListPools(context.Background(), "tenant-1", 200, 100)
	if err != nil {
		t.Fatalf("ListPools: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("len = %d, want 0", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("expectations: %v", err)
	}
}

func TestServiceListForecasts_ForwardsOffsetAndLimitUntouched(t *testing.T) {
	svc, mock := newTestService(t)

	mock.ExpectQuery("SELECT * FROM capacity_forecasts WHERE tenant_id=$1 ORDER BY forecast_date DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 40, 20).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "resource_type", "current_usage", "predicted",
			"threshold", "days_until_full", "recommendation", "forecast_date",
		}))

	items, err := svc.ListForecasts(context.Background(), "tenant-1", 40, 20)
	if err != nil {
		t.Fatalf("ListForecasts: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("len = %d, want 0", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("expectations: %v", err)
	}
}

func TestServiceListReports_ForwardsOffsetAndLimitUntouched(t *testing.T) {
	svc, mock := newTestService(t)

	mock.ExpectQuery("SELECT * FROM capacity_reports WHERE tenant_id=$1 ORDER BY generated_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 780, 20).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "title", "total_resources", "healthy_count",
			"warning_count", "critical_count", "overall_score",
			"alerts_snapshot", "forecasts_snapshot", "generated_at",
		}))

	items, err := svc.ListReports(context.Background(), "tenant-1", 780, 20)
	if err != nil {
		t.Fatalf("ListReports: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("len = %d, want 0", len(items))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("expectations: %v", err)
	}
}
