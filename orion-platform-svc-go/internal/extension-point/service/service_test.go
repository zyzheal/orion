package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/extension-point/repository"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// ServiceEx sits between the handler and the repository and owns nothing about
// pagination: the handler floors and caps, the repository binds. These tests
// run the real service over the real repository on top of sqlmock, so they
// prove both forwarding and the shape of the two queries together. A fake
// repository would have hidden the fact that the count and the list disagreed
// about their predicate.

func newTestService(t *testing.T) (*ServiceEx, *repository.Repository, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	repo := repository.NewRepository(sqlx.NewDb(db, "postgres"))
	return NewServiceEx(repo, &ExtensionRegistry{}, "tenant-1"), repo, mock
}

func epRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "category", "description", "handler_type",
		"config", "enabled", "priority", "status", "error",
		"registered_at", "initialized_at", "created_at", "updated_at",
	}).AddRow("ep-1", "tenant-1", "ext-a", "api", "", "builtin",
		[]byte("{}"), true, 10, "active", "",
		time.Now(), nil, time.Now(), time.Now())
}

func taskRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "extension_id", "name", "status", "duration_ms", "error",
		"started_at", "finished_at", "created_at",
	}).AddRow("t-1", "ext-a", "init:ext-a", "completed", 12, "",
		time.Now(), nil, time.Now())
}

func TestListExtensions_ForwardsTheWindowUntouched(t *testing.T) {
	s, _, mock := newTestService(t)

	mock.ExpectQuery("FROM extension_points WHERE tenant_id =").
		WithArgs("tenant-1", 50, 25).
		WillReturnRows(epRows())
	mock.ExpectQuery("SELECT COUNT").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(17))

	got, total, err := s.ListExtensions(context.Background(), "", "", 50, 25)
	if err != nil {
		t.Fatalf("ListExtensions: %v", err)
	}
	if len(got) != 1 || got[0].Name != "ext-a" {
		t.Fatalf("got %d summaries, want 1 named ext-a", len(got))
	}
	if total != 17 {
		t.Errorf("total = %d, want 17 (a page length would be 1)", total)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// The service used to count the whole tenant while the list applied both
// filters, so `?status=disabled` answered with a page of three rows and a total
// of seventeen. The count must carry the same filters.
func TestListExtensions_CountsTheSameRowsAsTheList(t *testing.T) {
	s, _, mock := newTestService(t)

	mock.ExpectQuery("OFFSET").
		WithArgs("tenant-1", "api", "disabled", 50, 25).
		WillReturnRows(epRows())
	mock.ExpectQuery("SELECT COUNT").
		WithArgs("tenant-1", "api", "disabled").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))

	_, total, err := s.ListExtensions(context.Background(), "api", "disabled", 50, 25)
	if err != nil {
		t.Fatalf("ListExtensions: %v", err)
	}
	if total != 3 {
		t.Errorf("total = %d, want 3 (the tenant total would be 17)", total)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestListStartupTasks_CountsByStatusWhenFiltered(t *testing.T) {
	s, _, mock := newTestService(t)

	mock.ExpectQuery("FROM startup_tasks WHERE status").
		WithArgs("running", 50, 25).
		WillReturnRows(taskRows())
	mock.ExpectQuery("FROM startup_tasks WHERE status =").
		WithArgs("running").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(4))

	_, total, err := s.ListStartupTasks(context.Background(), "running", 50, 25)
	if err != nil {
		t.Fatalf("ListStartupTasks: %v", err)
	}
	if total != 4 {
		t.Errorf("total = %d, want 4", total)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestListStartupTasks_CountsUnfilteredWhenUnfiltered(t *testing.T) {
	s, _, mock := newTestService(t)

	mock.ExpectQuery("FROM startup_tasks ORDER BY created_at DESC OFFSET").
		WithArgs(0, 25).
		WillReturnRows(taskRows())
	mock.ExpectQuery("FROM startup_tasks$").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(9))

	_, total, err := s.ListStartupTasks(context.Background(), "", 0, 25)
	if err != nil {
		t.Fatalf("ListStartupTasks: %v", err)
	}
	if total != 9 {
		t.Errorf("total = %d, want 9", total)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestListExtensions_WrapsTheRepositoryError(t *testing.T) {
	s, _, mock := newTestService(t)

	mock.ExpectQuery("FROM extension_points WHERE tenant_id =").
		WillReturnError(errors.New("boom"))

	_, total, err := s.ListExtensions(context.Background(), "", "", 0, 25)
	if err == nil {
		t.Fatal("expected the repository error to propagate")
	}
	if total != 0 {
		t.Errorf("total = %d, want 0 on error", total)
	}
	if !strings.Contains(err.Error(), "list extensions failed") || !strings.Contains(err.Error(), "boom") {
		t.Errorf("error = %v, want it wrapped", err)
	}
}
