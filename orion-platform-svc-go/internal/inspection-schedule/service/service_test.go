package service

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/auditlogger"
	"orion/platform-svc-go/internal/inspection-schedule/models"
	is_repo "orion/platform-svc-go/internal/inspection-schedule/repository"
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

func newSvc(t *testing.T) (*Service, sqlmock.Sqlmock) {
	db, mock := newMockDB(t)
	repo := is_repo.NewRepository(db)
	svc := NewService(repo, zap.NewNop())
	return svc, mock
}

func ctxTenant(tenantID string) context.Context {
	return baserepo.WithTenant(context.Background(), tenantID)
}

func TestCreate_Defaults(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`INSERT INTO inspection_schedules`).WillReturnResult(sqlmock.NewResult(0, 1))

	item, err := svc.Create(ctxTenant("t1"), "t1", &models.CreateScheduleRequest{
		Name:       "test-schedule",
		CronExpr:   "0 0 * * *",
		TemplateID: "tpl-1",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if item.ID == "" {
		t.Error("expected non-empty ID")
	}
	if _, err := uuid.Parse(item.ID); err != nil {
		t.Errorf("expected valid UUID, got %q: %v", item.ID, err)
	}
}

func TestCreate_WithEventAndAudit(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`INSERT INTO inspection_schedules`).WillReturnResult(sqlmock.NewResult(0, 1))

	pubCalled := false
	audCalled := false
	svc.SetPublisher(&fakePublisher{onPublish: func(string) { pubCalled = true }})
	svc.SetAuditLogger(&fakeAuditor{onLog: func() { audCalled = true }})

	_, err := svc.Create(ctxTenant("t1"), "t1", &models.CreateScheduleRequest{Name: "test", CronExpr: "0 0 * * *", TemplateID: "tpl-1"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if !pubCalled {
		t.Error("expected event published")
	}
	if !audCalled {
		t.Error("expected audit log written")
	}
}

func TestCreate_WithAuditLogger(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`INSERT INTO inspection_schedules`).WillReturnResult(sqlmock.NewResult(0, 1))

	logged := false
	svc.SetAuditLogger(&fakeAuditor{onLog: func() { logged = true }})

	_, err := svc.Create(ctxTenant("t1"), "t1", &models.CreateScheduleRequest{Name: "test", CronExpr: "0 0 * * *", TemplateID: "tpl-1"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if !logged {
		t.Error("expected audit log to be written")
	}
}

func TestList_Empty(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectQuery(`SELECT COUNT`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery(`SELECT.*FROM inspection_schedules`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "cron_expr", "template_id", "target_config", "next_run_at", "last_run_at", "last_result", "enabled", "created_at", "updated_at", "version"}))

	items, total, err := svc.List(ctxTenant("t1"), "t1", baserepo.NewListQuery())
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if total != 0 {
		t.Errorf("expected total 0, got %d", total)
	}
	if len(items) != 0 {
		t.Errorf("expected 0 items, got %d", len(items))
	}
}

func TestUpdate_NoFields(t *testing.T) {
	svc, _ := newSvc(t)
	_, err := svc.Update(ctxTenant("t1"), "t1", "sched-1", &models.UpdateScheduleRequest{}, 0)
	if err == nil {
		t.Fatal("expected error for no fields to update")
	}
}

func TestDelete_Success(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`DELETE FROM inspection_schedules`).WillReturnResult(sqlmock.NewResult(0, 1))

	ok, err := svc.Delete(ctxTenant("t1"), "t1", "sched-1")
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if !ok {
		t.Error("expected ok=true")
	}
}

func TestDelete_WithEventAndAudit(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`DELETE FROM inspection_schedules`).WillReturnResult(sqlmock.NewResult(0, 1))

	pubCalled := false
	audCalled := false
	svc.SetPublisher(&fakePublisher{onPublish: func(string) { pubCalled = true }})
	svc.SetAuditLogger(&fakeAuditor{onLog: func() { audCalled = true }})

	_, err := svc.Delete(ctxTenant("t1"), "t1", "sched-1")
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if !pubCalled {
		t.Error("expected event published on delete")
	}
	if !audCalled {
		t.Error("expected audit log on delete")
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
