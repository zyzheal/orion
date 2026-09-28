package service

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/ai/intelligence/repository"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func TestServiceErrors(t *testing.T) {
	if ErrIntelligenceTaskNotFound.Error() != "task not found" {
		t.Errorf("unexpected: %s", ErrIntelligenceTaskNotFound.Error())
	}
}

func newTestService(t *testing.T) (sqlmock.Sqlmock, *Service) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	return mock, NewService(repository.NewRepository(sqlx.NewDb(db, "sqlmock")))
}

// Every method in this service is a one-line passthrough. Pinning the arguments
// here is what stops a future edit from reinterpreting the pagination window at
// this layer: the handler owns the floor and the cap, so the service must not
// add a second one.
func TestServiceList_ForwardsOffsetAndLimitUntouched(t *testing.T) {
	mock, svc := newTestService(t)
	mock.ExpectQuery("SELECT * FROM intelligence_tasks WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 200, 100).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}))
	tasks, err := svc.List(context.Background(), "tenant-1", 200, 100)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(tasks) != 0 {
		t.Errorf("len(tasks) = %d, want 0", len(tasks))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestServiceCount_PassesTheTenantOnly(t *testing.T) {
	mock, svc := newTestService(t)
	mock.ExpectQuery("SELECT COUNT(*) FROM intelligence_tasks WHERE tenant_id=$1").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(5))
	count, err := svc.Count(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("Count: %v", err)
	}
	if count != 5 {
		t.Errorf("count = %d, want 5", count)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// The handler's nil guard depends on this: an empty table must come back as a
// non-nil slice here, not nil. The repository declares `var items []T`, so it
// can return nil, and the handler is the layer that normalises it.
func TestServiceList_ReturnsANonNilEmptySlice(t *testing.T) {
	mock, svc := newTestService(t)
	mock.ExpectQuery("SELECT * FROM intelligence_tasks WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 0, 20).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}))
	tasks, err := svc.List(context.Background(), "tenant-1", 0, 20)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if tasks != nil {
		t.Errorf("tasks = %v, want non-nil empty slice", tasks)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}
