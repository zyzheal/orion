package service

import (
	"context"
	"database/sql/driver"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/workflow/workflow/models"
	"orion/platform-svc-go/internal/workflow/workflow/repository"
)

var definitionColumns = []string{
	"id", "tenant_id", "name", "description", "nodes", "edges",
	"enabled", "version", "created_by", "created_at", "updated_at",
}

func definitionRows(enabled bool, name string) *sqlmock.Rows {
	// sqlmock hands driver.Value entries straight to Scan, so timestamps have to
	// be time.Time (a string would not convert into the model's time.Time fields).
	now := time.Now().UTC()
	row := []driver.Value{
		"wf-1", "tenant-a", name, "nightly deploy",
		`{"nodes":[]}`, `{"edges":[]}`,
		enabled, "1.0", "alice", now, now,
	}
	return sqlmock.NewRows(definitionColumns).AddRow(row...)
}

func newMockService(t *testing.T) (sqlmock.Sqlmock, *Service) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewService(repository.NewRepository(sqlx.NewDb(db, "postgres")))
}

func TestTerminateDisablesDefinitionAndCancelsInstances(t *testing.T) {
	mock, svc := newMockService(t)
	mock.ExpectQuery("SELECT \\* FROM workflow_definitions WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("wf-1", "tenant-a").
		WillReturnRows(definitionRows(true, "nightly deploy"))
	mock.ExpectExec("UPDATE workflow_instances").
		WithArgs(
			models.InstanceCancelled, "wf-1", "tenant-a",
			models.InstanceRunning, models.InstancePaused, "pending",
		).
		WillReturnResult(sqlmock.NewResult(0, 3))
	mock.ExpectQuery("UPDATE workflow_definitions SET").
		WithArgs(false, "wf-1", "tenant-a").
		WillReturnRows(definitionRows(false, "nightly deploy"))

	got, err := svc.Terminate(context.Background(), "tenant-a", "wf-1")
	if err != nil {
		t.Fatalf("Terminate: %v", err)
	}
	if got.Cancelled != 3 {
		t.Errorf("cancelled = %d, want 3", got.Cancelled)
	}
	if got.Definition == nil {
		t.Fatal("definition is nil, want the updated definition")
	}
	if got.Definition.Enabled {
		t.Error("definition is still enabled: terminating must disable it so triggers stop firing")
	}
	if m := mock.ExpectationsWereMet(); m != nil {
		t.Fatalf("unexpected SQL: %v", m)
	}
}

func TestTerminateReportsMissingDefinitions(t *testing.T) {
	mock, svc := newMockService(t)
	mock.ExpectQuery("SELECT \\* FROM workflow_definitions WHERE id=\\$1 AND tenant_id=\\$2").
		WithArgs("wf-missing", "tenant-a").
		WillReturnRows(sqlmock.NewRows(definitionColumns))

	_, err := svc.Terminate(context.Background(), "tenant-a", "wf-missing")
	if !errors.Is(err, ErrWorkflowNotFound) {
		t.Fatalf("err = %v, want ErrWorkflowNotFound: a foreign id must be a 404, not a success", err)
	}
	if m := mock.ExpectationsWereMet(); m != nil {
		t.Fatalf("no SQL beyond the ownership lookup: %v", m)
	}
}

func TestTerminateAbortsWhenCancellingFails(t *testing.T) {
	mock, svc := newMockService(t)
	mock.ExpectQuery("SELECT \\* FROM workflow_definitions WHERE id=\\$1 AND tenant_id=\\$2").
		WillReturnRows(definitionRows(true, "nightly deploy"))
	mock.ExpectExec("UPDATE workflow_instances").
		WillReturnError(sqlmock.ErrCancelled)

	_, err := svc.Terminate(context.Background(), "tenant-a", "wf-1")
	if err == nil {
		t.Fatal("expected an error when the cancellation fails")
	}
	// Only two calls must have been issued: the ownership lookup and the failed
	// cancellation. The disabling update must not have run.
	if m := mock.ExpectationsWereMet(); m != nil {
		t.Fatalf("unexpected SQL: %v", m)
	}
}
