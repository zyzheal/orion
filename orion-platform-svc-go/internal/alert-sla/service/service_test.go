package service

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/alert-sla/models"
	"orion/platform-svc-go/internal/auditlogger"
	alertsla_repo "orion/platform-svc-go/internal/alert-sla/repository"
	baserepo "orion/platform-svc-go/internal/repository"
)

// jsonConverter handles map/slice args by JSON-encoding them.
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
	repo := alertsla_repo.NewRepository(db)
	svc := NewService(repo, zap.NewNop())
	return svc, mock
}

func ctxTenant(tenantID string) context.Context {
	return baserepo.WithTenant(context.Background(), tenantID)
}

func TestCreate_Defaults(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`INSERT INTO alert_sla`).WillReturnResult(sqlmock.NewResult(0, 1))

	item, err := svc.Create(ctxTenant("t1"), "t1", &models.CreateSLARequest{
		Name: "test-sla",
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if item.ID == "" {
		t.Error("expected non-empty ID")
	}
	if item.Severity != "all" {
		t.Errorf("expected severity 'all', got %q", item.Severity)
	}
	if item.ResponseTime != 300 {
		t.Errorf("expected response_time 300, got %d", item.ResponseTime)
	}
	if item.ResolveTime != 3600 {
		t.Errorf("expected resolve_time 3600, got %d", item.ResolveTime)
	}
	if !item.Enabled {
		t.Error("expected enabled=true by default")
	}
}

func TestCreate_WithEventPublisher(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`INSERT INTO alert_sla`).WillReturnResult(sqlmock.NewResult(0, 1))

	// Use a fake publisher to verify event is published
	published := false
	svc.SetPublisher(&fakePublisher{
		onPublish: func(eventType string) { published = true; _ = eventType },
	})

	_, err := svc.Create(ctxTenant("t1"), "t1", &models.CreateSLARequest{Name: "test"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if !published {
		t.Error("expected event to be published")
	}
}

func TestCreate_WithAuditLogger(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`INSERT INTO alert_sla`).WillReturnResult(sqlmock.NewResult(0, 1))

	logged := false
	svc.SetAuditLogger(&fakeAuditor{
		onLog: func() { logged = true },
	})

	_, err := svc.Create(ctxTenant("t1"), "t1", &models.CreateSLARequest{Name: "test"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if !logged {
		t.Error("expected audit log to be written")
	}
}

func TestGet_Success(t *testing.T) {
	svc, mock := newSvc(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT.*FROM alert_sla`).
		WithArgs("t1", "sla-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "severity", "response_time", "resolve_time", "escalation_delay", "enabled", "created_at", "updated_at"}).
			AddRow("sla-1", "t1", "test", "critical", 300, 3600, 600, true, now, now))

	item, err := svc.Get(ctxTenant("t1"), "t1", "sla-1")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if item.Name != "test" {
		t.Errorf("expected name 'test', got %q", item.Name)
	}
}

func TestGet_NotFound(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectQuery(`SELECT.*FROM alert_sla`).
		WillReturnError(sql.ErrNoRows)

	_, err := svc.Get(ctxTenant("t1"), "t1", "nonexistent")
	if err == nil {
		t.Fatal("expected error for not found")
	}
}

func TestList_Pagination(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectQuery(`SELECT COUNT`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery(`SELECT.*FROM alert_sla`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "severity", "response_time", "resolve_time", "escalation_delay", "enabled", "created_at", "updated_at"}))

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
	_, err := svc.Update(ctxTenant("t1"), "t1", "sla-1", &models.UpdateSLARequest{}, 0)
	if err == nil {
		t.Fatal("expected error for no fields to update")
	}
}

func TestUpdate_WithTransaction(t *testing.T) {
	svc, mock := newSvc(t)
	now := time.Now().UTC()

	// Transaction: Begin
	mock.ExpectBegin()
	// UPDATE inside tx
	mock.ExpectExec(`UPDATE alert_sla SET`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	// SELECT inside tx (GetByID after update)
	mock.ExpectQuery(`SELECT.*FROM alert_sla`).
		WithArgs("t1", "sla-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "severity", "response_time", "resolve_time", "escalation_delay", "enabled", "created_at", "updated_at", "version"}).
			AddRow("sla-1", "t1", "updated", "critical", 600, 7200, 900, true, now, now, 2))
	// Commit
	mock.ExpectCommit()

	name := "updated"
	result, err := svc.Update(ctxTenant("t1"), "t1", "sla-1", &models.UpdateSLARequest{
		Name: &name,
	}, 0)
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if result.Name != "updated" {
		t.Errorf("expected name 'updated', got %q", result.Name)
	}
}

func TestUpdate_OptimisticLocking_VersionMismatch(t *testing.T) {
	svc, mock := newSvc(t)
	now := time.Now().UTC()

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE alert_sla SET`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	// The GetByID returns the same version as expectedVersion,
	// which triggers ErrVersionMismatch
	mock.ExpectQuery(`SELECT.*FROM alert_sla`).
		WithArgs("t1", "sla-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "severity", "response_time", "resolve_time", "escalation_delay", "enabled", "created_at", "updated_at", "version"}).
			AddRow("sla-1", "t1", "test", "critical", 300, 3600, 600, true, now, now, 1))
	mock.ExpectCommit()

	name := "updated"
	_, err := svc.Update(ctxTenant("t1"), "t1", "sla-1", &models.UpdateSLARequest{
		Name: &name,
	}, 1)
	if err == nil {
		t.Fatal("expected ErrVersionMismatch")
	}
	if !errors.Is(err, baserepo.ErrVersionMismatch) {
		t.Errorf("expected ErrVersionMismatch, got %v", err)
	}
}

func TestDelete_Success(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`DELETE FROM alert_sla`).WillReturnResult(sqlmock.NewResult(0, 1))

	ok, err := svc.Delete(ctxTenant("t1"), "t1", "sla-1")
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if !ok {
		t.Error("expected ok=true")
	}
}

func TestDelete_WithEventAndAudit(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`DELETE FROM alert_sla`).WillReturnResult(sqlmock.NewResult(0, 1))

	pubCalled := false
	audCalled := false
	svc.SetPublisher(&fakePublisher{onPublish: func(string) { pubCalled = true }})
	svc.SetAuditLogger(&fakeAuditor{onLog: func() { audCalled = true }})

	_, err := svc.Delete(ctxTenant("t1"), "t1", "sla-1")
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

func TestCreate_GeneratesUUID(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`INSERT INTO alert_sla`).WillReturnResult(sqlmock.NewResult(0, 1))

	item, err := svc.Create(ctxTenant("t1"), "t1", &models.CreateSLARequest{Name: "test"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if _, err := uuid.Parse(item.ID); err != nil {
		t.Errorf("expected valid UUID, got %q: %v", item.ID, err)
	}
}

// fakePublisher captures Publish calls for assertion.
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

// fakeAuditor captures Log calls for assertion.
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
