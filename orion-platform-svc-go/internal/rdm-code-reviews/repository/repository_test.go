package repository

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"reflect"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/rdm-code-reviews/models"
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

func TestCreateCodeReview_ExecutesInsert(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectExec(`INSERT INTO rdm_code_reviews`).WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.CreateCodeReview(ctxTenant("t1"), &models.CodeReview{ID: "r1", TenantID: "t1", Title: "test"})
	if err != nil {
		t.Fatalf("CreateCodeReview: %v", err)
	}
}

func TestDeleteCodeReview_ExecutesDelete(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectExec(`DELETE FROM rdm_code_reviews`).WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.DeleteCodeReview(ctxTenant("t1"), "t1", "r1")
	if err != nil {
		t.Fatalf("DeleteCodeReview: %v", err)
	}
}

func TestCreateComment_ExecutesInsert(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectExec(`INSERT INTO rdm_code_review_comments`).WillReturnResult(sqlmock.NewResult(0, 1))
	// The CreateComment also increments comments_count on parent review
	mock.ExpectExec(`UPDATE rdm_code_reviews SET comments_count`).WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.CreateComment(ctxTenant("t1"), &models.CodeReviewComment{ID: "c1", TenantID: "t1", ReviewID: "r1"})
	if err != nil {
		t.Fatalf("CreateComment: %v", err)
	}
}

func TestCreateCodeReview_MissingTenant(t *testing.T) {
	db, _ := newMockDB(t)
	repo := NewRepository(db)

	err := repo.CreateCodeReview(context.Background(), &models.CodeReview{ID: "r1", TenantID: "t1"})
	if err == nil {
		t.Fatal("expected error for missing tenant context")
	}
}
