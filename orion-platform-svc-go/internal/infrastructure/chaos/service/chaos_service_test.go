package service

import (
	"context"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/infrastructure/chaos/repository"
)

// ListExperiments used to own the clamp and the derivation. It derived the
// offset before clamping page and page_size, so `?page=0` and `?page=-5` bound a
// negative OFFSET and Postgres answered with an error instead of a page. The
// page_size cap also came after the derivation, so a large page_size moved the
// offset but not the limit. Both halves of the ordering now live in the handler,
// and the service is a pass-through.
//
// These tests run the real service on the real repository over sqlmock, so a
// service that re-derives, re-clamps or drops the offset shows up as the wrong
// bound argument rather than as a silent page.

const listQuery = "SELECT * FROM chaos_experiments WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"

func newMockService(t *testing.T) (sqlmock.Sqlmock, *ChaosService) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewChaosService(repository.NewChaosRepository(sqlx.NewDb(db, "postgres")))
}

func TestListExperiments_ForwardsOffsetAndLimitUntouched(t *testing.T) {
	mock, svc := newMockService(t)

	mock.ExpectQuery(listQuery).
		WithArgs("tenant-1", 25, 50).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "status"}))

	_, err := svc.ListExperiments(context.Background(), "tenant-1", 50, 25)
	if err != nil {
		t.Fatalf("ListExperiments: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// limit=500 is above the handler's cap of 100 on purpose: the service must not
// re-apply it, and it must not re-derive an offset from a page number. Reverting
// to the old body would bind limit=100 and offset=-500 here.
func TestListExperiments_DoesNotReapplyTheHandlerClamp(t *testing.T) {
	mock, svc := newMockService(t)

	mock.ExpectQuery(listQuery).
		WithArgs("tenant-1", 500, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "status"}))

	_, err := svc.ListExperiments(context.Background(), "tenant-1", 0, 500)
	if err != nil {
		t.Fatalf("ListExperiments: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestListExperiments_WrapsTheRepositoryError(t *testing.T) {
	mock, svc := newMockService(t)
	mock.ExpectQuery(listQuery).
		WithArgs("tenant-1", 25, 50).
		WillReturnError(errors.New("driver said no"))

	_, err := svc.ListExperiments(context.Background(), "tenant-1", 50, 25)
	if err == nil {
		t.Fatal("ListExperiments returned nil error for a repository failure")
	}
}
