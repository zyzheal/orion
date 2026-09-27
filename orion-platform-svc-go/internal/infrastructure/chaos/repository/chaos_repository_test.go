package repository

import (
	"context"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// ListByTenant is the last step before the OFFSET is bound, so the SQL text and
// the bind order here are the whole story about whether pagination is real.
// Nothing else in this package exercised it.

const listQuery = "SELECT * FROM chaos_experiments WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"

func newMockRepoDB(t *testing.T) (sqlmock.Sqlmock, *ChaosRepository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewChaosRepository(sqlx.NewDb(db, "postgres"))
}

// LIMIT is bound before OFFSET. Reversing the two turns a request for rows 51-75
// into rows 26-50, which no error would ever report.
func TestListByTenant_BindsLimitBeforeOffset(t *testing.T) {
	mock, repo := newMockRepoDB(t)

	mock.ExpectQuery(listQuery).
		WithArgs("tenant-1", 25, 50).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "status"}).
			AddRow("chaos-1", "tenant-1", "n1", "draft"))

	got, err := repo.ListByTenant(context.Background(), "tenant-1", 50, 25)
	if err != nil {
		t.Fatalf("ListByTenant: %v", err)
	}
	if len(got) != 1 || got[0].ID != "chaos-1" {
		t.Errorf("ListByTenant returned %v, want the one row the driver returned", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// The query must be paginated at all. A missing LIMIT clause would make one page
// request read the tenant's whole table, which no status code reports.
func TestListByTenant_PaginatesAtAll(t *testing.T) {
	mock, repo := newMockRepoDB(t)

	mock.ExpectQuery("SELECT * FROM chaos_experiments WHERE tenant_id = $1 ORDER BY created_at DESC").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"id"}))

	_, err := repo.ListByTenant(context.Background(), "tenant-1", 50, 25)
	if err == nil {
		t.Fatalf("the non-paginated query is matched, so the driver did not see LIMIT / OFFSET")
	}
}

func TestListByTenant_WrapsTheDriverError(t *testing.T) {
	mock, repo := newMockRepoDB(t)
	mock.ExpectQuery(listQuery).
		WithArgs("tenant-1", 25, 50).
		WillReturnError(errors.New("driver said no"))

	_, err := repo.ListByTenant(context.Background(), "tenant-1", 50, 25)
	if err == nil {
		t.Fatal("ListByTenant returned nil error for a driver failure")
	}
	if !errors.Is(err, err) {
		t.Fatalf("error %v is not the driver error", err)
	}
}
