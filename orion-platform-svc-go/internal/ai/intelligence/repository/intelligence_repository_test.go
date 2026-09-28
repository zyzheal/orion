package repository

import (
	"context"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/ai/intelligence/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// The SQL in this repository is single-line, so QueryMatcherEqual matches it
// literally. No escaping: `*` and `$1` are compared as-is.
func newMockDB(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	return mock, NewRepository(sqlx.NewDb(db, "sqlmock"))
}

func ts() time.Time {
	return time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
}

func taskColumns() []string {
	return []string{"id", "tenant_id", "name", "created_at", "insight_type",
		"source", "confidence", "data", "status"}
}

// OFFSET $2 LIMIT $3 but the arguments are tenantID, offset, limit: the second
// and third bound values are the pagination window, so binding them in the wrong
// order is a valid query Postgres executes happily. page=3&page_size=20 would
// start at row 60 instead of row 40.
func TestList_BindsTenantOffsetAndLimit(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectQuery("SELECT * FROM intelligence_tasks WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 50, 25).
		WillReturnRows(sqlmock.NewRows(taskColumns()).AddRow(
			"t-1", "tenant-1", "n1", ts(), "drift", "scan", 0.9, []byte(`{}`), "pending",
		))

	tasks, err := repo.List(context.Background(), "tenant-1", 50, 25)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("len(tasks) = %d, want 1", len(tasks))
	}
	if tasks[0].ID != "t-1" || tasks[0].TenantID != "tenant-1" {
		t.Errorf("task = %+v, want t-1 / tenant-1", tasks[0])
	}
	if tasks[0].Confidence != 0.9 {
		t.Errorf("confidence = %v, want 0.9", tasks[0].Confidence)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// An empty table must come back as an empty slice, not a slice the caller
// cannot tell from nil. The handler depends on len == 0 to answer "data":[].
func TestList_EmptyTableYieldsZeroRows(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectQuery("SELECT * FROM intelligence_tasks WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 0, 20).
		WillReturnRows(sqlmock.NewRows(taskColumns()))
	tasks, err := repo.List(context.Background(), "tenant-1", 0, 20)
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

func TestList_PropagatesTheDriverError(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectQuery("SELECT * FROM intelligence_tasks WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3").
		WithArgs("tenant-1", 0, 20).
		WillReturnError(errors.New("connection refused"))
	tasks, err := repo.List(context.Background(), "tenant-1", 0, 20)
	if err == nil {
		t.Fatalf("List returned nil error")
	}
	if tasks != nil {
		t.Errorf("tasks = %v, want nil", tasks)
	}
}

// tenant_id is the only isolation axis. A list query without it reads every
// tenant's tasks.
func TestGetByID_BindsTheTenant(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectQuery("SELECT * FROM intelligence_tasks WHERE id=$1 AND tenant_id=$2").
		WithArgs("t-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows(taskColumns()).AddRow(
			"t-1", "tenant-1", "n1", ts(), "drift", "scan", 0.5, []byte(`{}`), "done",
		))
	d, err := repo.GetByID(context.Background(), "tenant-1", "t-1")
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if d.ID != "t-1" || d.TenantID != "tenant-1" {
		t.Errorf("task = %+v", d)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestDelete_BindsTheTenant(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectExec("DELETE FROM intelligence_tasks WHERE id=$1 AND tenant_id=$2").
		WithArgs("t-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	if err := repo.Delete(context.Background(), "tenant-1", "t-1"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestCount_BindsTheTenant(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectQuery("SELECT COUNT(*) FROM intelligence_tasks WHERE tenant_id=$1").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))
	count, err := repo.Count(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("Count: %v", err)
	}
	if count != 3 {
		t.Errorf("count = %d, want 3", count)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// The insert binds nine values in column order. A reordering there is silent:
// the row looks fine and the data is in the wrong columns.
func TestCreate_BindsEveryColumn(t *testing.T) {
	mock, repo := newMockDB(t)
	mock.ExpectExec("INSERT INTO intelligence_tasks (id, tenant_id, name, insight_type, source, confidence, data, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)").
		WithArgs("t-1", "tenant-1", "n1", "drift", "scan", 0.7, models.JSONB{"a": 1}, "pending", ts()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	if err := repo.Create(context.Background(), &models.IntelligenceTask{
		ID: "t-1", TenantID: "tenant-1", Name: "n1", InsightType: "drift", Source: "scan",
		Confidence: 0.7, Data: models.JSONB{"a": 1}, Status: "pending", CreatedAt: ts(),
	}); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}
