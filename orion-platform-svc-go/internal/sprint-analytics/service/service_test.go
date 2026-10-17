package service

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"reflect"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/auditlogger"
	"orion/platform-svc-go/internal/sprint-analytics/models"
	sa_repo "orion/platform-svc-go/internal/sprint-analytics/repository"
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
	// Handle any slice type (e.g. []models.ActionItem, []models.Rule)
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

func newSvc(t *testing.T) (*SprintService, sqlmock.Sqlmock) {
	db, mock := newMockDB(t)
	repo := sa_repo.NewRepository(db)
	svc := NewSprintService(repo, zap.NewNop())
	return svc, mock
}

func ctxTenant(tenantID string) context.Context {
	return baserepo.WithTenant(context.Background(), tenantID)
}

func TestCreateReview_Defaults(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`INSERT INTO sprint_reviews`).WillReturnResult(sqlmock.NewResult(0, 1))

	item, err := svc.CreateReview(ctxTenant("t1"), "t1", &models.CreateReviewRequest{SprintID: "sprint-1"})
	if err != nil {
		t.Fatalf("CreateReview: %v", err)
	}
	if item.ID == "" {
		t.Error("expected non-empty ID")
	}
	if _, err := uuid.Parse(item.ID); err != nil {
		t.Errorf("expected valid UUID, got %q: %v", item.ID, err)
	}
	if item.Status != "pending" {
		t.Errorf("expected status 'pending', got %q", item.Status)
	}
}

func TestCreateReview_WithEventAndAudit(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`INSERT INTO sprint_reviews`).WillReturnResult(sqlmock.NewResult(0, 1))

	pubCalled := false
	audCalled := false
	svc.SetPublisher(&fakePublisher{onPublish: func(string) { pubCalled = true }})
	svc.SetAuditLogger(&fakeAuditor{onLog: func() { audCalled = true }})

	_, err := svc.CreateReview(ctxTenant("t1"), "t1", &models.CreateReviewRequest{SprintID: "sprint-1"})
	if err != nil {
		t.Fatalf("CreateReview: %v", err)
	}
	if !pubCalled {
		t.Error("expected event published")
	}
	if !audCalled {
		t.Error("expected audit log written")
	}
}

func TestCreateReview_WithAuditLogger(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`INSERT INTO sprint_reviews`).WillReturnResult(sqlmock.NewResult(0, 1))

	logged := false
	svc.SetAuditLogger(&fakeAuditor{onLog: func() { logged = true }})

	_, err := svc.CreateReview(ctxTenant("t1"), "t1", &models.CreateReviewRequest{SprintID: "sprint-1"})
	if err != nil {
		t.Fatalf("CreateReview: %v", err)
	}
	if !logged {
		t.Error("expected audit log to be written")
	}
}

func TestDeleteReview_Success(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`DELETE FROM sprint_reviews`).WillReturnResult(sqlmock.NewResult(0, 1))

	ok, err := svc.DeleteReview(ctxTenant("t1"), "t1", "rev-1")
	if err != nil {
		t.Fatalf("DeleteReview: %v", err)
	}
	if !ok {
		t.Error("expected ok=true")
	}
}

func TestDeleteReview_WithEventAndAudit(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`DELETE FROM sprint_reviews`).WillReturnResult(sqlmock.NewResult(0, 1))

	pubCalled := false
	audCalled := false
	svc.SetPublisher(&fakePublisher{onPublish: func(string) { pubCalled = true }})
	svc.SetAuditLogger(&fakeAuditor{onLog: func() { audCalled = true }})

	_, err := svc.DeleteReview(ctxTenant("t1"), "t1", "rev-1")
	if err != nil {
		t.Fatalf("DeleteReview: %v", err)
	}
	if !pubCalled {
		t.Error("expected event published on delete")
	}
	if !audCalled {
		t.Error("expected audit log on delete")
	}
}

func TestCreateRetro_WithEvent(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`INSERT INTO sprint_retrospectives`).WillReturnResult(sqlmock.NewResult(0, 1))

	pubCalled := false
	svc.SetPublisher(&fakePublisher{onPublish: func(string) { pubCalled = true }})

	_, err := svc.CreateRetro(ctxTenant("t1"), "t1", &models.CreateRetroRequest{SprintID: "sprint-1"})
	if err != nil {
		t.Fatalf("CreateRetro: %v", err)
	}
	if !pubCalled {
		t.Error("expected event published")
	}
}

func TestDeleteRetro_Success(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`DELETE FROM sprint_retrospectives`).WillReturnResult(sqlmock.NewResult(0, 1))

	ok, err := svc.DeleteRetro(ctxTenant("t1"), "t1", "retro-1")
	if err != nil {
		t.Fatalf("DeleteRetro: %v", err)
	}
	if !ok {
		t.Error("expected ok=true")
	}
}

func TestDeleteRetro_WithEvent(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`DELETE FROM sprint_retrospectives`).WillReturnResult(sqlmock.NewResult(0, 1))

	pubCalled := false
	svc.SetPublisher(&fakePublisher{onPublish: func(string) { pubCalled = true }})

	_, err := svc.DeleteRetro(ctxTenant("t1"), "t1", "retro-1")
	if err != nil {
		t.Fatalf("DeleteRetro: %v", err)
	}
	if !pubCalled {
		t.Error("expected event published on delete")
	}
}

type fakePublisher struct {
	onPublish func(eventType string)
}

func (f *fakePublisher) Publish(ctx context.Context, eventType, tenantID string, payload map[string]any) error {
	_ = ctx
	_ = tenantID
	_ = payload
	if f.onPublish != nil {
		f.onPublish(eventType)
	}
	return nil
}

type fakeAuditor struct {
	onLog func()
}

func (f *fakeAuditor) Log(ctx context.Context, entry auditlogger.AuditEntry) error {
	_ = ctx
	_ = entry
	if f.onLog != nil {
		f.onLog()
	}
	return nil
}
