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

	"orion/platform-svc-go/internal/sprint-analytics/models"
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
	mock.ExpectExec(`INSERT INTO sprint_reviews`).WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.CreateReview(ctxTenant("t1"), &models.SprintReview{ID: "rev-1", TenantID: "t1", SprintID: "sprint-1"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
}

func TestCreate_MissingTenant(t *testing.T) {
	db, _ := newMockDB(t)
	repo := NewRepository(db)

	err := repo.CreateReview(context.Background(), &models.SprintReview{ID: "rev-1", TenantID: "t1", SprintID: "sprint-1"})
	if err == nil {
		t.Fatal("expected error for missing tenant context")
	}
}

func TestDelete_ExecutesDelete(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectExec(`DELETE FROM sprint_reviews`).WillReturnResult(sqlmock.NewResult(0, 1))

	ok, err := repo.DeleteReview(ctxTenant("t1"), "t1", "test-1")
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
	mock.ExpectExec(`UPDATE sprint_reviews SET`).WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.UpdateReview(ctxTenant("t1"), "t1", "test-1", map[string]interface{}{"status": "updated"}, 0)
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
}

func TestWithTx_Commit(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE sprint_reviews SET`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := repo.WithTx(ctxTenant("t1"), func(rtx *Repository) error {
		return rtx.UpdateReview(ctxTenant("t1"), "t1", "test-1", map[string]interface{}{"status": "updated"}, 0)
	})
	if err != nil {
		t.Fatalf("WithTx: %v", err)
	}
}

func TestWithTx_Rollback(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE sprint_reviews SET`).WillReturnError(sql.ErrConnDone)
	mock.ExpectRollback()

	err := repo.WithTx(ctxTenant("t1"), func(rtx *Repository) error {
		return rtx.UpdateReview(ctxTenant("t1"), "t1", "test-1", map[string]interface{}{"status": "updated"}, 0)
	})
	if err == nil {
		t.Fatal("expected error from failed update")
	}
}

func TestCreateRetro_ExecutesInsert(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectExec(`INSERT INTO sprint_retrospectives`).WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.CreateRetro(ctxTenant("t1"), &models.SprintRetrospective{ID: "retro-1", TenantID: "t1", SprintID: "sprint-1"})
	if err != nil {
		t.Fatalf("CreateRetro: %v", err)
	}
}

func TestDeleteRetro_ExecutesDelete(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectExec(`DELETE FROM sprint_retrospectives`).WillReturnResult(sqlmock.NewResult(0, 1))

	ok, err := repo.DeleteRetro(ctxTenant("t1"), "t1", "retro-1")
	if err != nil {
		t.Fatalf("DeleteRetro: %v", err)
	}
	if !ok {
		t.Error("expected ok=true")
	}
}
