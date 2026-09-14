package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"testing"
	"time"

	"orion/platform-svc-go/internal/capability/models"
)

type mockCapabilityRepo struct {
	capabilities map[string]*models.Capability
	tperms       map[string]*models.TemporaryPermission
	tpermSeq     int
	prSeq        int
	dbErr        error
}

func newMockCapRepo() *mockCapabilityRepo {
	return &mockCapabilityRepo{
		capabilities: map[string]*models.Capability{},
		tperms:       map[string]*models.TemporaryPermission{},
	}
}

func (m *mockCapabilityRepo) Create(_ context.Context, c *models.Capability) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	if c.ID == "" {
		c.ID = c.Name + "-id"
	}
	m.capabilities[c.TenantID+":"+c.ID] = c
	return nil
}

func (m *mockCapabilityRepo) GetByID(_ context.Context, tenantID, id string) (*models.Capability, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	c, ok := m.capabilities[tenantID+":"+id]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return c, nil
}

func (m *mockCapabilityRepo) List(_ context.Context, tenantID string, _limit, _offset int) ([]models.Capability, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	var out []models.Capability
	for _, c := range m.capabilities {
		if c.TenantID == tenantID {
			out = append(out, *c)
		}
	}
	return out, nil
}

func (m *mockCapabilityRepo) ListRoot(_ context.Context, tenantID string) ([]models.Capability, error) {
	return nil, nil
}

func (m *mockCapabilityRepo) ListByParent(_ context.Context, tenantID, parentID string) ([]models.Capability, error) {
	return nil, nil
}

func (m *mockCapabilityRepo) ListByCategory(_ context.Context, tenantID, category string, limit, offset int) ([]models.Capability, error) {
	return nil, nil
}

func (m *mockCapabilityRepo) Update(_ context.Context, tenantID, id string, updates map[string]interface{}) error {
	c, ok := m.capabilities[tenantID+":"+id]
	if !ok {
		return sql.ErrNoRows
	}
	if v, ok := updates["name"]; ok {
		c.Name = v.(string)
	}
	return nil
}

func (m *mockCapabilityRepo) Delete(_ context.Context, tenantID, id string) error {
	_, ok := m.capabilities[tenantID+":"+id]
	if !ok {
		return sql.ErrNoRows
	}
	delete(m.capabilities, tenantID+":"+id)
	return nil
}

func (m *mockCapabilityRepo) GrantCapabilityToRole(_ context.Context, tenantID, capabilityID, roleName string) error {
	return nil
}

func (m *mockCapabilityRepo) RevokeCapabilityFromRole(_ context.Context, tenantID, capabilityID, roleName string) error {
	return nil
}

func (m *mockCapabilityRepo) ListCapabilityIDsByRole(_ context.Context, tenantID, roleName string) ([]string, error) {
	return []string{roleName + "-cap"}, nil
}

func (m *mockCapabilityRepo) GrantCapabilityToUser(_ context.Context, tenantID, capabilityID, targetUserID, grantedBy string, expiresInHours *int) error {
	return nil
}

func (m *mockCapabilityRepo) RevokeCapabilityFromUser(_ context.Context, tenantID, capabilityID, targetUserID string) error {
	return nil
}

func (m *mockCapabilityRepo) ListCapabilityIDsByUser(_ context.Context, tenantID, userID string) ([]string, error) {
	if m.dbErr != nil {
		return nil, m.dbErr
	}
	return []string{userID + "-cap"}, nil
}

func (m *mockCapabilityRepo) GetUserGrantExpiry(_ context.Context, tenantID, capabilityID, userID string) (*time.Time, error) {
	return nil, nil
}

func (m *mockCapabilityRepo) InsertCommandMapping(_ context.Context, tenantID, capabilityID, commandName, commandAction string, envSuffix *string) error {
	return nil
}

func (m *mockCapabilityRepo) GetCapabilityIDForCommand(_ context.Context, tenantID, command, action, env string) (string, error) {
	return "cmd-cap", nil
}

func (m *mockCapabilityRepo) CheckPermission(_ context.Context, tenantID, capabilityID, userID string, roles []string) (bool, string, error) {
	if m.dbErr != nil {
		return false, "", m.dbErr
	}
	return true, "role", nil
}

func (m *mockCapabilityRepo) GrantTemporaryPermission(_ context.Context, tenantID, userID, capabilityID, grantedBy, reason string, envSuffix *string, expires int) error {
	if m.dbErr != nil {
		return m.dbErr
	}
	m.tpermSeq++
	id := fmt.Sprintf("tp%08d", m.tpermSeq)
	m.tperms[id] = &models.TemporaryPermission{
		ID:           id,
		TenantID:     tenantID,
		UserID:       userID,
		CapabilityID: capabilityID,
		GrantedBy:    grantedBy,
		Reason:       reason,
		ExpiresAt:    time.Now().UTC().Add(time.Duration(expires) * time.Hour),
		GrantedAt:    time.Now().UTC(),
	}
	return nil
}

func (m *mockCapabilityRepo) GetActiveTemporaryPermissions(_ context.Context, tenantID, userID string) ([]models.TemporaryPermission, error) {
	var out []models.TemporaryPermission
	for _, t := range m.tperms {
		if t.UserID == userID && t.TenantID == tenantID {
			out = append(out, *t)
		}
	}
	return out, nil
}

func (m *mockCapabilityRepo) GetActiveTempExpiry(_ context.Context, tenantID, capabilityID, userID string) (*time.Time, error) {
	exp := time.Now().UTC().Add(1 * time.Hour)
	return &exp, nil
}

func (m *mockCapabilityRepo) GetTemporaryPermissionByID(_ context.Context, tenantID string, id string) (*models.TemporaryPermission, error) {
	t, ok := m.tperms[id]
	if ok && t.TenantID != tenantID {
		return nil, sql.ErrNoRows
	}
	if !ok {
		return nil, sql.ErrNoRows
	}
	return t, nil
}

func (m *mockCapabilityRepo) RevokeTemporaryPermissionByID(_ context.Context, tenantID, id string) error {
	t, ok := m.tperms[id]
	if !ok || t.TenantID != tenantID {
		return sql.ErrNoRows
	}
	delete(m.tperms, id)
	return nil
}

func (m *mockCapabilityRepo) CleanupExpiredTemporaryPermissions(_ context.Context, tenantID string) (int, error) {
	return 0, nil
}

func (m *mockCapabilityRepo) CreatePermissionRequest(_ context.Context, tenantID, userID, capabilityID, reason string, duration *int, envSuffix *string) error {
	return nil
}

func (m *mockCapabilityRepo) GetPermissionRequestByID(_ context.Context, tenantID string, ticketID string) (*models.PermissionRequest, error) {
	m.prSeq++
	if ticketID == "" {
		ticketID = fmt.Sprintf("pr%08d", m.prSeq)
	}
	return &models.PermissionRequest{
		ID:            ticketID,
		TenantID:      tenantID,
		Status:        "pending",
		UserID:        "u1",
		CapabilityID:  "c1",
		DurationHours: intPtr(8),
	}, nil
}

func (m *mockCapabilityRepo) ApprovePermissionRequest(_ context.Context, tenantID, ticketID, approverID string) error {
	return nil
}

func (m *mockCapabilityRepo) RejectPermissionRequest(_ context.Context, tenantID, ticketID, rejecterID string, reason *string) error {
	return nil
}

func (m *mockCapabilityRepo) GetUserPermissionRequests(_ context.Context, tenantID, userID string) ([]models.PermissionRequest, error) {
	return nil, nil
}

func (m *mockCapabilityRepo) InsertAuditLog(_ context.Context, tenantID, action, userID, targetType, targetID, details string) error {
	return nil
}

func (m *mockCapabilityRepo) ListAuditLogs(_ context.Context, tenantID string, q *models.AuditLogQuery) ([]models.AuditLog, error) {
	return []models.AuditLog{{
		ID: "log-1", TenantID: tenantID, Action: "grant",
		UserID: "u1", TargetType: "capability", TargetID: "c1", Details: "{}",
		CreatedAt: time.Now().UTC(),
	}}, nil
}

// The mock must satisfy the interface the service actually uses. If a method
// signature changes on one side only, this line is what makes the build fail.
var _ RepositoryInterface = (*mockCapabilityRepo)(nil)

func intPtr(i int) *int { return &i }

func newTestCapService(repo *mockCapabilityRepo) *Service {
	return &Service{repo: repo}
}

func setupCapability(repo *mockCapabilityRepo, tenantID, id string) *models.Capability {
	c := &models.Capability{ID: id, TenantID: tenantID, Name: "test-cap"}
	repo.capabilities[tenantID+":"+id] = c
	return c
}

func TestCreateCapability_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockCapRepo()
	svc := newTestCapService(repo)

	c, err := svc.Create(ctx, "t1", models.CreateCapabilityRequest{Name: "new-cap"})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if c.Name != "new-cap" {
		t.Errorf("expected 'new-cap', got %s", c.Name)
	}
	if c.TenantID != "t1" {
		t.Errorf("expected tenant 't1', got %s", c.TenantID)
	}
}

func TestGetCapability_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockCapRepo()
	setupCapability(repo, "t1", "c1")
	svc := newTestCapService(repo)

	c, err := svc.Get(ctx, "t1", "c1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if c.Name != "test-cap" {
		t.Errorf("expected 'test-cap', got %s", c.Name)
	}
}

func TestGetCapability_NotFound(t *testing.T) {
	ctx := context.Background()
	repo := newMockCapRepo()
	svc := newTestCapService(repo)

	_, err := svc.Get(ctx, "t1", "nonexist")
	if !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("expected sql.ErrNoRows, got %v", err)
	}
}

func TestUpdateCapability_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockCapRepo()
	setupCapability(repo, "t1", "c1")
	svc := newTestCapService(repo)

	name := "updated-name"
	_, err := svc.Update(ctx, "t1", "c1", models.UpdateCapabilityRequest{Name: &name})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	c, _ := repo.GetByID(ctx, "t1", "c1")
	if c.Name != "updated-name" {
		t.Errorf("expected 'updated-name', got %s", c.Name)
	}
}

func TestDeleteCapability_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockCapRepo()
	setupCapability(repo, "t1", "c1")
	svc := newTestCapService(repo)

	err := svc.Delete(ctx, "t1", "c1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	_, err = repo.GetByID(ctx, "t1", "c1")
	if !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("expected capability deleted")
	}
}

func TestGrantCapabilityToRole_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockCapRepo()
	setupCapability(repo, "t1", "c1")
	svc := newTestCapService(repo)

	err := svc.GrantCapabilityToRole(ctx, "t1", "c1", "admin", "u1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestGrantCapabilityToRole_CapabilityNotFound(t *testing.T) {
	ctx := context.Background()
	repo := newMockCapRepo()
	svc := newTestCapService(repo)

	err := svc.GrantCapabilityToRole(ctx, "t1", "nonexist", "admin", "u1")
	if !errors.Is(err, ErrCapabilityNotFound) {
		t.Errorf("expected ErrCapabilityNotFound, got %v", err)
	}
}

func TestCheckPermission_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockCapRepo()
	svc := newTestCapService(repo)

	result, err := svc.CheckPermission(ctx, "t1", models.CheckPermissionRequest{
		UserID:       "u1",
		CapabilityID: "c1",
		UserRoles:    []string{"admin"},
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !result.Allowed {
		t.Error("expected allowed true")
	}
}

func TestGetCapabilityForCommand_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockCapRepo()
	svc := newTestCapService(repo)

	cap, err := svc.GetCapabilityForCommand(ctx, "t1", "kubectl", "apply", "")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if cap == nil || *cap != "cmd-cap" {
		t.Errorf("expected 'cmd-cap', got %v", cap)
	}
}

func TestGrantTemporaryPermission_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockCapRepo()
	setupCapability(repo, "t1", "c1")
	svc := newTestCapService(repo)

	req := models.GrantTemporaryRequest{
		TenantID:       "t1",
		UserID:         "u1",
		CapabilityID:   "c1",
		GrantedBy:      "admin",
		Reason:         "test",
		ExpiresInHours: 24,
	}
	perm, err := svc.GrantTemporaryPermission(ctx, req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if perm.UserID != "u1" {
		t.Errorf("expected userID 'u1', got %s", perm.UserID)
	}
}

func TestGrantTemporaryPermission_InvalidDuration(t *testing.T) {
	ctx := context.Background()
	repo := newMockCapRepo()
	setupCapability(repo, "t1", "c1")
	svc := newTestCapService(repo)

	req := models.GrantTemporaryRequest{
		TenantID:       "t1",
		UserID:         "u1",
		CapabilityID:   "c1",
		ExpiresInHours: -1,
	}
	_, err := svc.GrantTemporaryPermission(ctx, req)
	if err != ErrInvalidDuration {
		t.Errorf("expected ErrInvalidDuration, got %v", err)
	}
}

func TestGetAuditLogs_Success(t *testing.T) {
	ctx := context.Background()
	repo := newMockCapRepo()
	svc := newTestCapService(repo)

	logs, err := svc.GetAuditLogs(ctx, "t1", models.AuditLogQuery{})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if logs == nil {
		t.Error("expected non-nil logs slice")
	}
}

func TestErrorSentinels(t *testing.T) {
	tests := []struct {
		err error
		msg string
	}{
		{ErrNotFound, "not found"},
		{ErrCapabilityNotFound, "capability not found"},
		{ErrInvalidDuration, "invalid duration"},
		{ErrDurationExceedsLimit, "duration exceeds limit"},
	}
	for _, tt := range tests {
		if tt.err.Error() != tt.msg {
			t.Errorf("expected %q, got %q", tt.msg, tt.err.Error())
		}
	}
}
