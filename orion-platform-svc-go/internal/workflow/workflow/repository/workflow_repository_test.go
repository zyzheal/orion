package repository

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/workflow/workflow/models"
)

func newMockRepo(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

func TestCancelRunningInstancesCancelsOnlyLiveStates(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec("UPDATE workflow_instances SET status=\\$1, updated_at=NOW\\(\\)").
		WithArgs(
			models.InstanceCancelled, "wf-1", "tenant-a",
			models.InstanceRunning, models.InstancePaused, "pending",
		).
		WillReturnResult(sqlmock.NewResult(0, 3))

	got, err := repo.CancelRunningInstances(context.Background(), "tenant-a", "wf-1")
	if err != nil {
		t.Fatalf("CancelRunningInstances: %v", err)
	}
	if got != 3 {
		t.Errorf("cancelled = %d, want 3", got)
	}
	if m := mock.ExpectationsWereMet(); m != nil {
		t.Fatalf("unexpected SQL: %v", m)
	}
}

func TestCancelRunningInstancesReturnsZeroWhenNothingIsLive(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec("UPDATE workflow_instances").
		WillReturnResult(sqlmock.NewResult(0, 0))

	got, err := repo.CancelRunningInstances(context.Background(), "tenant-a", "wf-empty")
	if err != nil {
		t.Fatalf("CancelRunningInstances: %v", err)
	}
	if got != 0 {
		t.Errorf("cancelled = %d, want 0", got)
	}
}

func TestCancelRunningInstancesSurfacesDatabaseErrors(t *testing.T) {
	mock, repo := newMockRepo(t)
	mock.ExpectExec("UPDATE workflow_instances").
		WillReturnError(sqlmock.ErrCancelled)

	got, err := repo.CancelRunningInstances(context.Background(), "tenant-a", "wf-1")
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
	if got != 0 {
		t.Errorf("cancelled = %d on error, want 0", got)
	}
}
