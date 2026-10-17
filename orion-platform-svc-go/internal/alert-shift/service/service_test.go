package service

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/alert-shift/models"
	"orion/platform-svc-go/internal/auditlogger"
	alertshift_repo "orion/platform-svc-go/internal/alert-shift/repository"
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
	repo := alertshift_repo.NewRepository(db)
	svc := NewService(repo, zap.NewNop())
	return svc, mock
}

func ctxTenant(tenantID string) context.Context {
	return baserepo.WithTenant(context.Background(), tenantID)
}

func TestCreateShift_Defaults(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`INSERT INTO alert_shifts`).WillReturnResult(sqlmock.NewResult(0, 1))

	shift, err := svc.CreateShift(ctxTenant("t1"), "t1", &models.CreateShiftRequest{Name: "test-shift"})
	if err != nil {
		t.Fatalf("CreateShift: %v", err)
	}
	if shift.ID == "" {
		t.Error("expected non-empty ID")
	}
	if shift.Pattern != "round_robin" {
		t.Errorf("expected pattern 'round_robin', got %q", shift.Pattern)
	}
	if !shift.Enabled {
		t.Error("expected enabled=true by default")
	}
	if len(shift.Weekdays) != 5 {
		t.Errorf("expected 5 weekdays, got %d", len(shift.Weekdays))
	}
}

func TestCreateShift_WithEventAndAudit(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`INSERT INTO alert_shifts`).WillReturnResult(sqlmock.NewResult(0, 1))

	pubCalled := false
	audCalled := false
	svc.SetPublisher(&fakePublisher{onPublish: func(string) { pubCalled = true }})
	svc.SetAuditLogger(&fakeAuditor{onLog: func() { audCalled = true }})

	_, err := svc.CreateShift(ctxTenant("t1"), "t1", &models.CreateShiftRequest{Name: "test"})
	if err != nil {
		t.Fatalf("CreateShift: %v", err)
	}
	if !pubCalled {
		t.Error("expected event published")
	}
	if !audCalled {
		t.Error("expected audit log written")
	}
}

func TestGetShift_DBError(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectQuery(`SELECT.*FROM alert_shifts`).
		WillReturnError(sql.ErrNoRows)

	_, err := svc.GetShift(ctxTenant("t1"), "t1", "missing")
	if err == nil {
		t.Fatal("expected error for not found")
	}
}

func TestGetShift_NotFound(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectQuery(`SELECT.*FROM alert_shifts`).
		WillReturnError(sql.ErrNoRows)

	_, err := svc.GetShift(ctxTenant("t1"), "t1", "missing")
	if err == nil {
		t.Fatal("expected error for not found")
	}
}

func TestListShifts_Pagination(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectQuery(`SELECT COUNT`).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery(`SELECT.*FROM alert_shifts`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "name", "team", "pattern", "start_time", "end_time", "weekdays", "enabled", "created_at", "updated_at", "version"}))

	items, total, err := svc.ListShifts(ctxTenant("t1"), "t1", baserepo.NewListQuery())
	if err != nil {
		t.Fatalf("ListShifts: %v", err)
	}
	if total != 0 {
		t.Errorf("expected total 0, got %d", total)
	}
	if len(items) != 0 {
		t.Errorf("expected 0 items, got %d", len(items))
	}
}

func TestUpdateShift_NoFields(t *testing.T) {
	svc, _ := newSvc(t)
	_, err := svc.UpdateShift(ctxTenant("t1"), "t1", "shift-1", &models.UpdateShiftRequest{}, 0)
	if err == nil {
		t.Fatal("expected error for no fields to update")
	}
}

func TestUpdateShift_WithAuditLogger(t *testing.T) {
	svc, mock := newSvc(t)

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE alert_shifts SET`).
		WillReturnError(sql.ErrConnDone)
	mock.ExpectRollback()

	name := "updated"
	_, err := svc.UpdateShift(ctxTenant("t1"), "t1", "shift-1", &models.UpdateShiftRequest{Name: &name}, 0)
	if err == nil {
		t.Fatal("expected error from failed update")
	}
}

func TestDeleteShift_Success(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`DELETE FROM alert_shifts`).WillReturnResult(sqlmock.NewResult(0, 1))

	ok, err := svc.DeleteShift(ctxTenant("t1"), "t1", "shift-1")
	if err != nil {
		t.Fatalf("DeleteShift: %v", err)
	}
	if !ok {
		t.Error("expected ok=true")
	}
}

func TestCreateShift_GeneratesUUID(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`INSERT INTO alert_shifts`).WillReturnResult(sqlmock.NewResult(0, 1))

	shift, err := svc.CreateShift(ctxTenant("t1"), "t1", &models.CreateShiftRequest{Name: "test"})
	if err != nil {
		t.Fatalf("CreateShift: %v", err)
	}
	if _, err := uuid.Parse(shift.ID); err != nil {
		t.Errorf("expected valid UUID, got %q: %v", shift.ID, err)
	}
}

func TestDeleteShift_WithEventAndAudit(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`DELETE FROM alert_shifts`).WillReturnResult(sqlmock.NewResult(0, 1))

	pubCalled := false
	audCalled := false
	svc.SetPublisher(&fakePublisher{onPublish: func(string) { pubCalled = true }})
	svc.SetAuditLogger(&fakeAuditor{onLog: func() { audCalled = true }})

	_, err := svc.DeleteShift(ctxTenant("t1"), "t1", "shift-1")
	if err != nil {
		t.Fatalf("DeleteShift: %v", err)
	}
	if !pubCalled {
		t.Error("expected event published on delete")
	}
	if !audCalled {
		t.Error("expected audit log on delete")
	}
}

func TestCreateShift_WithAuditLogger(t *testing.T) {
	svc, mock := newSvc(t)
	mock.ExpectExec(`INSERT INTO alert_shifts`).WillReturnResult(sqlmock.NewResult(0, 1))

	logged := false
	svc.SetAuditLogger(&fakeAuditor{onLog: func() { logged = true }})

	_, err := svc.CreateShift(ctxTenant("t1"), "t1", &models.CreateShiftRequest{Name: "test"})
	if err != nil {
		t.Fatalf("CreateShift: %v", err)
	}
	if !logged {
		t.Error("expected audit log to be written")
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
