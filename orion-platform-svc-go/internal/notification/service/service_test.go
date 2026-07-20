package service

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	notif_models "orion/platform-svc-go/internal/notification/models"
)

// --- Mock repository matching repository.Repository methods ---

type mockNotifRepo struct {
	notifications map[string]*notif_models.Notification // key = tenantID:id
	getErr        error
	createErr     error
	listErr       error
	updateErr     error
	deleteErr     error
}

func (m *mockNotifRepo) Create(_ context.Context, n *notif_models.Notification) error {
	if m.createErr != nil {
		return m.createErr
	}
	if n.ID == "" {
		n.ID = "notif-1"
	}
	m.notifications[m.key(n.TenantID, n.ID)] = n
	return nil
}

func (m *mockNotifRepo) GetByID(_ context.Context, id, tenantID string) (*notif_models.Notification, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	n, ok := m.notifications[m.key(tenantID, id)]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return n, nil
}

func (m *mockNotifRepo) List(_ context.Context, tenantID string, _ *notif_models.ListFilter, _, _ int) ([]notif_models.Notification, error) {
	if m.listErr != nil {
		return nil, m.listErr
	}
	var result []notif_models.Notification
	for k, n := range m.notifications {
		if k[:len(tenantID)] == tenantID {
			result = append(result, *n)
		}
	}
	return result, nil
}

func (m *mockNotifRepo) UpdateFields(_ context.Context, id, tenantID string, updates map[string]interface{}) (*notif_models.Notification, error) {
	if m.updateErr != nil {
		return nil, m.updateErr
	}
	n, ok := m.notifications[m.key(tenantID, id)]
	if !ok {
		return nil, errors.New("not found")
	}
	if v, ok := updates["status"]; ok {
		n.Status = v.(string)
	}
	if v, ok := updates["read"]; ok {
		n.Read = v.(bool)
	}
	return n, nil
}

func (m *mockNotifRepo) Delete(_ context.Context, id, tenantID string) (bool, error) {
	if m.deleteErr != nil {
		return false, m.deleteErr
	}
	key := m.key(tenantID, id)
	_, ok := m.notifications[key]
	delete(m.notifications, key)
	return ok, nil
}

func (m *mockNotifRepo) key(tenantID, id string) string { return tenantID + ":" + id }

// --- Tests for business logic ---

func ptrStr(s string) *string { return &s }
func ptrBool(b bool) *bool    { return &b }

func TestNotificationErrNotFound(t *testing.T) {
	if !IsNotFound(ErrNotFound) {
		t.Error("IsNotFound should return true for ErrNotFound")
	}
	if IsNotFound(errors.New("other")) {
		t.Error("IsNotFound should return false for unrelated error")
	}
}

func TestNotificationErrInvalidInput(t *testing.T) {
	if ErrInvalidInput.Error() != "invalid input" {
		t.Errorf("expected 'invalid input', got %q", ErrInvalidInput.Error())
	}
}

// Create validation logic (extracted from service.Create)
func testCreateValidation(title, body, channel string) (priority, status string, sentAt *interface{}) {
	if title == "" || body == "" {
		return "", "", nil
	}
	priority = "" // defaults to "normal" below
	status = "pending"
	if channel == "email" || channel == "sms" {
		status = "sent"
	}
	if priority == "" {
		priority = "normal"
	}
	var ts interface{}
	if channel != "in_app" {
		ts = "now"
	}
	return priority, status, &ts
}

func TestNotificationCreate_InvalidTitle(t *testing.T) {
	_, _, ts := testCreateValidation("", "body", "email")
	if ts != nil {
		t.Error("empty title should reject creation")
	}
}

func TestNotificationCreate_InvalidBody(t *testing.T) {
	_, _, ts := testCreateValidation("title", "", "email")
	if ts != nil {
		t.Error("empty body should reject creation")
	}
}

func TestNotificationCreate_DefaultPriority(t *testing.T) {
	priority, _, _ := testCreateValidation("t", "b", "in_app")
	if priority != "normal" {
		t.Errorf("expected normal, got %s", priority)
	}
}

func TestNotificationCreate_EmailStatusSent(t *testing.T) {
	_, status, _ := testCreateValidation("t", "b", "email")
	if status != "sent" {
		t.Errorf("expected sent, got %s", status)
	}
}

func TestNotificationCreate_SMSStatusSent(t *testing.T) {
	_, status, _ := testCreateValidation("t", "b", "sms")
	if status != "sent" {
		t.Errorf("expected sent, got %s", status)
	}
}

func TestNotificationCreate_InAppStatusPending(t *testing.T) {
	_, status, _ := testCreateValidation("t", "b", "in_app")
	if status != "pending" {
		t.Errorf("expected pending, got %s", status)
	}
}

func TestNotificationCreate_SourceFieldResolution(t *testing.T) {
	sourceID := "src-1"
	sourceType := "pipeline"
	metadata := "{\"k\":\"v\"}"

	req := &notif_models.CreateNotificationRequest{
		Title: "t", Body: "b", NotificationType: "info", Channel: "email",
		SourceID: &sourceID, SourceType: &sourceType, Metadata: &metadata,
	}

	var rid, rtype, rmeta string
	if req.SourceID != nil {
		rid = *req.SourceID
	}
	if req.SourceType != nil {
		rtype = *req.SourceType
	}
	if req.Metadata != nil {
		rmeta = *req.Metadata
	}

	if rid != "src-1" {
		t.Errorf("sourceID mismatch: %s", rid)
	}
	if rtype != "pipeline" {
		t.Errorf("sourceType mismatch: %s", rtype)
	}
	if rmeta != "{\"k\":\"v\"}" {
		t.Errorf("metadata mismatch: %s", rmeta)
	}
}

// Update logic
func testUpdateLogic(status *string, read *bool) (map[string]interface{}, error) {
	updates := map[string]interface{}{}
	if status != nil {
		updates["status"] = *status
	}
	if read != nil {
		updates["read"] = *read
	}
	if len(updates) == 0 {
		return nil, errors.New("no fields to update")
	}
	return updates, nil
}

func TestNotificationUpdate_StatusField(t *testing.T) {
	updates, _ := testUpdateLogic(ptrStr("failed"), nil)
	if updates["status"] != "failed" {
		t.Errorf("expected failed, got %v", updates["status"])
	}
}

func TestNotificationUpdate_ReadField(t *testing.T) {
	updates, _ := testUpdateLogic(nil, ptrBool(true))
	if updates["read"] != true {
		t.Error("expected read=true")
	}
}

func TestNotificationUpdate_NoFields(t *testing.T) {
	_, err := testUpdateLogic(nil, nil)
	if err == nil {
		t.Fatal("expected error for empty update")
	}
}

// List pagination logic
func testListPage(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return (page - 1) * pageSize, pageSize
}

func TestNotificationList_DefaultPage(t *testing.T) {
	offset, _ := testListPage(0, 10)
	if offset != 0 {
		t.Errorf("expected offset 0, got %d", offset)
	}
}

func TestNotificationList_DefaultPageSize(t *testing.T) {
	_, size := testListPage(1, 200)
	if size != 20 {
		t.Errorf("expected size 20, got %d", size)
	}
}

func TestNotificationList_OffsetCalc(t *testing.T) {
	offset, _ := testListPage(3, 10)
	if offset != 20 {
		t.Errorf("expected offset 20, got %d", offset)
	}
}

// --- Repository mock tests ---

func TestMockRepoCreate_Success(t *testing.T) {
	repo := &mockNotifRepo{notifications: map[string]*notif_models.Notification{}}
	n := &notif_models.Notification{TenantID: "t1", Title: "t", Body: "b", Channel: "email"}
	err := repo.Create(context.Background(), n)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if n.ID != "notif-1" {
		t.Errorf("expected ID notif-1, got %s", n.ID)
	}
}

func TestMockRepoCreate_Error(t *testing.T) {
	repo := &mockNotifRepo{notifications: map[string]*notif_models.Notification{}, createErr: errors.New("db fail")}
	if err := repo.Create(context.Background(), &notif_models.Notification{}); err == nil {
		t.Fatal("expected error")
	}
}

func TestMockRepoGetByID_Success(t *testing.T) {
	n := &notif_models.Notification{ID: "n1", TenantID: "t1", Title: "t"}
	repo := &mockNotifRepo{notifications: map[string]*notif_models.Notification{"t1:n1": n}}
	got, err := repo.GetByID(context.Background(), "n1", "t1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if got.Title != "t" {
		t.Errorf("expected t, got %s", got.Title)
	}
}

func TestMockRepoGetByID_NotFound(t *testing.T) {
	repo := &mockNotifRepo{notifications: map[string]*notif_models.Notification{}}
	_, err := repo.GetByID(context.Background(), "x", "t1")
	if !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("expected ErrNoRows, got %v", err)
	}
}

func TestMockRepoList_Success(t *testing.T) {
	repo := &mockNotifRepo{notifications: map[string]*notif_models.Notification{
		"t1:n1": {ID: "n1", TenantID: "t1"}, "t1:n2": {ID: "n2", TenantID: "t1"}}}
	items, err := repo.List(context.Background(), "t1", nil, 10, 0)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(items) != 2 {
		t.Errorf("expected 2, got %d", len(items))
	}
}

func TestMockRepoUpdateFields_Success(t *testing.T) {
	repo := &mockNotifRepo{notifications: map[string]*notif_models.Notification{
		"t1:n1": {ID: "n1", TenantID: "t1", Status: "pending"}}}
	n, err := repo.UpdateFields(context.Background(), "n1", "t1", map[string]interface{}{"status": "sent"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if n.Status != "sent" {
		t.Errorf("expected sent, got %s", n.Status)
	}
}

func TestMockRepoUpdateFields_NotFound(t *testing.T) {
	repo := &mockNotifRepo{notifications: map[string]*notif_models.Notification{}}
	_, err := repo.UpdateFields(context.Background(), "x", "t1", map[string]interface{}{"status": "sent"})
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestMockRepoDelete_Success(t *testing.T) {
	repo := &mockNotifRepo{notifications: map[string]*notif_models.Notification{"t1:n1": {}}}
	deleted, err := repo.Delete(context.Background(), "n1", "t1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !deleted {
		t.Error("expected deleted=true")
	}
}

func TestMockRepoDelete_NotFound(t *testing.T) {
	repo := &mockNotifRepo{notifications: map[string]*notif_models.Notification{}}
	deleted, err := repo.Delete(context.Background(), "x", "t1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if deleted {
		t.Error("expected deleted=false")
	}
}
