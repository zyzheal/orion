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

	"orion/platform-svc-go/internal/alert-shift/models"
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
	mock.ExpectExec(`INSERT INTO alert_shifts`).WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.CreateShift(ctxTenant("t1"), &models.Shift{ID: "shift-1", TenantID: "t1", Name: "test"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
}

func TestCreate_MissingTenant(t *testing.T) {
	db, _ := newMockDB(t)
	repo := NewRepository(db)

	err := repo.CreateShift(context.Background(), &models.Shift{ID: "shift-1", TenantID: "t1", Name: "test"})
	if err == nil {
		t.Fatal("expected error for missing tenant context")
	}
}

func TestDelete_ExecutesDelete(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectExec(`DELETE FROM alert_shifts`).WillReturnResult(sqlmock.NewResult(0, 1))

	ok, err := repo.DeleteShift(ctxTenant("t1"), "t1", "test-1")
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
	mock.ExpectExec(`UPDATE alert_shifts SET`).WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.UpdateShift(ctxTenant("t1"), "t1", "test-1", map[string]interface{}{"name": "updated"}, 0)
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
}

func TestWithTx_Commit(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE alert_shifts SET`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := repo.WithTx(ctxTenant("t1"), func(rtx *Repository) error {
		return rtx.UpdateShift(ctxTenant("t1"), "t1", "test-1", map[string]interface{}{"name": "updated"}, 0)
	})
	if err != nil {
		t.Fatalf("WithTx: %v", err)
	}
}

func TestWithTx_Rollback(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE alert_shifts SET`).WillReturnError(sql.ErrConnDone)
	mock.ExpectRollback()

	err := repo.WithTx(ctxTenant("t1"), func(rtx *Repository) error {
		return rtx.UpdateShift(ctxTenant("t1"), "t1", "test-1", map[string]interface{}{"name": "updated"}, 0)
	})
	if err == nil {
		t.Fatal("expected error from failed update")
	}
}

func TestList_EmptyResult(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectQuery(`SELECT COUNT`).WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery(`SELECT.*FROM alert_shifts`).WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "team", "pattern", "start_time", "end_time", "weekdays", "enabled", "created_at", "updated_at", "version"}))

	items, total, err := repo.ListShifts(ctxTenant("t1"), "t1", baserepo.NewListQuery())
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if total != 0 || len(items) != 0 {
		t.Errorf("expected 0 items, got %d (total %d)", len(items), total)
	}
}

func TestCreateAssignment_ExecutesInsert(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectExec(`INSERT INTO alert_shift_assignments`).WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.CreateAssignment(ctxTenant("t1"), &models.Assignment{ID: "a1", TenantID: "t1", ShiftID: "s1", UserID: "u1"})
	if err != nil {
		t.Fatalf("CreateAssignment: %v", err)
	}
}
