package repository

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"reflect"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/inspection-schedule/models"
	baserepo "orion/platform-svc-go/internal/repository"
)

type jsonConverter struct{}

func (jsonConverter) ConvertValue(v interface{}) (driver.Value, error) {
	switch v.(type) {
	case map[string]interface{}, []interface{}, []string, []int:
		b, err := json.Marshal(v)
		if err != nil {
			return nil, err
		}
		return string(b), nil
	}
	if reflect.TypeOf(v).Kind() == reflect.Slice {
		b, err := json.Marshal(v)
		if err != nil {
			return nil, err
		}
		return string(b), nil
	}
	return driver.DefaultParameterConverter.ConvertValue(v)
}

func newMockDB(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(
		sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp),
		sqlmock.ValueConverterOption(jsonConverter{}),
	)
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	mock.MatchExpectationsInOrder(false)
	return sqlx.NewDb(db, "postgres"), mock
}

func ctxTenant(tenantID string) context.Context {
	return baserepo.WithTenant(context.Background(), tenantID)
}

func TestCreate_ExecutesInsert(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectExec(`INSERT INTO inspection_schedules`).WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.Create(ctxTenant("t1"), &models.InspectionSchedule{ID: "sched-1", TenantID: "t1", Name: "test", TemplateID: "tpl-1"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
}

func TestCreate_MissingTenant(t *testing.T) {
	db, _ := newMockDB(t)
	repo := NewRepository(db)

	err := repo.Create(context.Background(), &models.InspectionSchedule{ID: "sched-1", TenantID: "t1", Name: "test", TemplateID: "tpl-1"})
	if err == nil {
		t.Fatal("expected error for missing tenant context")
	}
}

func TestDelete_ExecutesDelete(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectExec(`DELETE FROM inspection_schedules`).WillReturnResult(sqlmock.NewResult(0, 1))

	ok, err := repo.Delete(ctxTenant("t1"), "t1", "test-1")
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if !ok {
		t.Error("expected ok=true")
	}
}

func TestUpdate_ExecutesUpdate(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectExec(`UPDATE inspection_schedules SET`).WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.Update(ctxTenant("t1"), "t1", "test-1", map[string]interface{}{"name": "updated"}, 0)
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
}

func TestWithTx_Commit(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE inspection_schedules SET`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := repo.WithTx(ctxTenant("t1"), func(rtx *Repository) error {
		return rtx.Update(ctxTenant("t1"), "t1", "test-1", map[string]interface{}{"name": "updated"}, 0)
	})
	if err != nil {
		t.Fatalf("WithTx: %v", err)
	}
}

func TestWithTx_Rollback(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE inspection_schedules SET`).WillReturnError(sql.ErrConnDone)
	mock.ExpectRollback()

	err := repo.WithTx(ctxTenant("t1"), func(rtx *Repository) error {
		return rtx.Update(ctxTenant("t1"), "t1", "test-1", map[string]interface{}{"name": "updated"}, 0)
	})
	if err == nil {
		t.Fatal("expected error from failed update")
	}
}

func TestList_EmptyResult(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectQuery(`SELECT COUNT`).WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery(`SELECT.*FROM inspection_schedules`).WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "cron_expr", "template_id", "target_config", "next_run_at", "last_run_at", "last_result", "enabled", "created_at", "updated_at", "version"}))

	items, total, err := repo.List(ctxTenant("t1"), "t1", baserepo.NewListQuery())
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if total != 0 || len(items) != 0 {
		t.Errorf("expected 0 items, got %d (total %d)", len(items), total)
	}
}

func TestUpdateRunStatus_ExecutesUpdate(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectExec(`UPDATE inspection_schedules SET last_run_at`).WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.UpdateRunStatus(ctxTenant("t1"), "t1", "sched-1", "2026-01-01T00:00:00Z", "success", "2026-01-02T00:00:00Z")
	if err != nil {
		t.Fatalf("UpdateRunStatus: %v", err)
	}
}
