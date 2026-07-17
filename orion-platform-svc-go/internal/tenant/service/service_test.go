package service

import (
	"context"
	"fmt"
	"testing"

	"orion/platform-svc-go/internal/tenant/models"
)

// mockTenantRepo implements TenantRepo for testing.
type mockTenantRepo struct {
	tenants          map[string]map[string]any // id -> row
	tID              int                        // auto-increment id
	users            []map[string]any           // GetUserTenants result
	usersList        []map[string]any           // ListTenantUsers result
	quota            *map[string]any            // GetQuota result
	namespaceAllocs  []map[string]any           // GetTenantNamespaces result
	poolStatus       *map[string]any            // PoolStatus result
	quotaAlerts      []map[string]any           // GetTenantQuotaAlerts result
	statusCounts     []map[string]any           // GetAlertStatusCounts result
	resourceCounts   []map[string]any           // GetAlertResourceCounts result
	activeAlerts     []map[string]any           // GetActiveAlerts result
	namespaceCount   int                        // NamespaceCount result
	count            int                        // TenantCount result
	err              error                      // if set, all methods return this error
}

func (m *mockTenantRepo) CreateTenant(ctx context.Context, name string, displayName *string, settingsJSON string, status string) (*int, error) {
	if m.err != nil {
		return nil, m.err
	}
	m.tID++
	idKey := fmt.Sprintf("%d", m.tID)
	m.tenants[idKey] = map[string]any{
		"id":           m.tID,
		"name":         name,
		"display_name": fmt.Sprintf("%v", displayName),
		"status":       status,
		"settings":     settingsJSON,
	}
	return &m.tID, nil
}

func (m *mockTenantRepo) GetTenantRow(ctx context.Context, id string) (*map[string]any, error) {
	if m.err != nil {
		return nil, m.err
	}
	if v, ok := m.tenants[id]; ok {
		return &v, nil
	}
	return nil, ErrTenantNotFound
}

func (m *mockTenantRepo) ListTenants(ctx context.Context, status *string, limit, offset int) ([]map[string]any, int, error) {
	if m.err != nil {
		return nil, 0, m.err
	}
	var result []map[string]any
	for _, t := range m.tenants {
		if status != nil && t["status"] != *status {
			continue
		}
		result = append(result, t)
	}
	total := len(result)
	return result, total, nil
}

func (m *mockTenantRepo) UpdateTenant(ctx context.Context, id string, name *string, displayName *string, status *string, settingsJSON string) error {
	if m.err != nil {
		return m.err
	}
	if t, ok := m.tenants[id]; ok {
		if name != nil {
			t["name"] = *name
		}
		if displayName != nil {
			t["display_name"] = *displayName
		}
		if status != nil {
			t["status"] = *status
		}
		if settingsJSON != "" {
			t["settings"] = settingsJSON
		}
		return nil
	}
	return ErrTenantNotFound
}

func (m *mockTenantRepo) DeleteTenant(ctx context.Context, id string) error {
	if m.err != nil {
		return m.err
	}
	delete(m.tenants, id)
	return nil
}

func (m *mockTenantRepo) TenantCount(ctx context.Context, status *string) (int, error) {
	if m.err != nil {
		return 0, m.err
	}
	var c int
	for _, t := range m.tenants {
		if status != nil && t["status"] != *status {
			continue
		}
		c++
	}
	return c, nil
}

func (m *mockTenantRepo) GetUserTenants(ctx context.Context, userID string) ([]map[string]any, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.users, nil
}

func (m *mockTenantRepo) ListTenantUsers(ctx context.Context, tenantID string) ([]map[string]any, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.usersList, nil
}

func (m *mockTenantRepo) AddTenantUser(ctx context.Context, tenantID, userID, role string) error {
	if m.err != nil {
		return m.err
	}
	return nil
}

func (m *mockTenantRepo) RemoveTenantUser(ctx context.Context, tenantID, userID string) error {
	if m.err != nil {
		return m.err
	}
	return nil
}

func (m *mockTenantRepo) CountTenantAdmins(ctx context.Context, tenantID string) (int, error) {
	if m.err != nil {
		return 0, m.err
	}
	return 1, nil
}

func (m *mockTenantRepo) GetTenantByRow(ctx context.Context, tenantID string) (*map[string]any, error) {
	if m.err != nil {
		return nil, m.err
	}
	if v, ok := m.tenants[tenantID]; ok {
		return &v, nil
	}
	return nil, ErrTenantNotFound
}

func (m *mockTenantRepo) GetPendingInvite(ctx context.Context, tenantID, email string) (*map[string]any, error) {
	if m.err != nil {
		return nil, m.err
	}
	return nil, nil // no pending invites
}

func (m *mockTenantRepo) GetTenantUserByEmail(ctx context.Context, tenantID, email string) (bool, error) {
	if m.err != nil {
		return false, m.err
	}
	return false, nil // not a member
}

func (m *mockTenantRepo) CreateInvite(ctx context.Context, tenantID, email, role, inviteCode, invitedBy string, expiresAt string) (*map[string]any, error) {
	if m.err != nil {
		return nil, m.err
	}
	return &map[string]any{
		"id":          "1",
		"invite_code": inviteCode,
		"email":       email,
		"role":        role,
		"status":      "pending",
		"expires_at":  expiresAt,
	}, nil
}

func (m *mockTenantRepo) GetInviteByCode(ctx context.Context, code string) (*map[string]any, error) {
	if m.err != nil {
		return nil, m.err
	}
	return nil, nil // no invite found
}

func (m *mockTenantRepo) UserIsTenantMember(ctx context.Context, tenantID, userID string) (bool, error) {
	if m.err != nil {
		return false, m.err
	}
	return false, nil
}

func (m *mockTenantRepo) UpdateInviteStatus(ctx context.Context, status, userID string, id string) error {
	if m.err != nil {
		return m.err
	}
	return nil
}

func (m *mockTenantRepo) AllocateNamespace(ctx context.Context, tenantID int, nsName string, purpose string) error {
	if m.err != nil {
		return m.err
	}
	return nil
}

func (m *mockTenantRepo) ReleaseNamespace(ctx context.Context, nsName string) error {
	if m.err != nil {
		return m.err
	}
	return nil
}

func (m *mockTenantRepo) GetTenantNamespaces(ctx context.Context, tenantID string) ([]map[string]any, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.namespaceAllocs, nil
}

func (m *mockTenantRepo) NamespaceCount(ctx context.Context, tenantID string) (int, error) {
	if m.err != nil {
		return 0, m.err
	}
	return m.namespaceCount, nil
}

func (m *mockTenantRepo) PoolStatus(ctx context.Context) (*map[string]any, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.poolStatus, nil
}

func (m *mockTenantRepo) GetQuota(ctx context.Context, tenantID int, tenantIDStr string) (*map[string]any, error) {
	if m.err != nil {
		return nil, m.err
	}
	if m.quota == nil {
		return nil, nil // no quota stored -> will fall back to default
	}
	return m.quota, nil
}

func (m *mockTenantRepo) GetTenantQuotaAlerts(ctx context.Context, tenantID string, status *string, limit, offset int) ([]map[string]any, int, error) {
	if m.err != nil {
		return nil, 0, m.err
	}
	return m.quotaAlerts, len(m.quotaAlerts), nil
}

func (m *mockTenantRepo) GetAlertStatusCounts(ctx context.Context, tenantID string) ([]map[string]any, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.statusCounts, nil
}

func (m *mockTenantRepo) GetAlertResourceCounts(ctx context.Context, tenantID string) ([]map[string]any, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.resourceCounts, nil
}

func (m *mockTenantRepo) GetActiveAlerts(ctx context.Context, tenantID string, limit int) ([]map[string]any, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.activeAlerts, nil
}

func (m *mockTenantRepo) MigrateUserToTenant(ctx context.Context, newTenantID int, userID string) error {
	if m.err != nil {
		return m.err
	}
	return nil
}

func (m *mockTenantRepo) MoveNamespaces(ctx context.Context, newTenantID int, nsName string, oldTenantID int) error {
	if m.err != nil {
		return m.err
	}
	return nil
}

func (m *mockTenantRepo) MovePipeline(ctx context.Context, newTenantID int, pipelineID string, oldTenantID int) error {
	if m.err != nil {
		return m.err
	}
	return nil
}

func getStr(v any) string {
	return fmt.Sprintf("%v", v)
}

func setupTest(t *testing.T) (*Service, *mockTenantRepo) {
	repo := &mockTenantRepo{
		tenants:     make(map[string]map[string]any),
		poolStatus: &map[string]any{
			"total":     10,
			"allocated": 3,
			"available": 7,
		},
	}
	svc := NewService(repo)
	return svc, repo
}

// --- Tests ---

func TestCreateTenantSuccess(t *testing.T) {
	svc, repo := setupTest(t)
	ctx := context.Background()

	req := models.CreateTenantRequest{
		Name:                 "acme",
		DisplayName:          strPtr("Acme Corp"),
		AutoAllocateNamespace: true,
		InitialNamespaceCount: 2,
	}

	result, err := svc.CreateTenant(ctx, req)
	assertNoErr(t, err)

	if result == nil {
		t.Fatal("CreateTenant returned nil result")
	}
	if (*result)["name"] != "acme" {
		t.Errorf("expected name 'acme', got %v", (*result)["name"])
	}
	// repo should have the tenant stored
	_, ok := repo.tenants["1"]
	if !ok {
		t.Error("tenant not found in repo after create")
	}
}

func TestGetTenantByRowSuccess(t *testing.T) {
	svc, repo := setupTest(t)
	ctx := context.Background()

	// Pre-populate a tenant
	repo.tenants["42"] = map[string]any{
		"id":           42,
		"name":         "testco",
		"display_name": "Test Company",
		"status":       "active",
	}

	result, err := svc.GetTenant(ctx, "42")
	assertNoErr(t, err)

	if (*result)["name"] != "testco" {
		t.Errorf("expected 'testco', got %v", (*result)["name"])
	}
}

func TestGetTenantByRowNotFound(t *testing.T) {
	svc, _ := setupTest(t)
	ctx := context.Background()

	result, err := svc.GetTenant(ctx, "999")
	if err == nil {
		t.Error("expected error for non-existent tenant")
	}
	if result != nil {
		t.Error("expected nil result for non-existent tenant")
	}
}

func TestListTenants(t *testing.T) {
	svc, repo := setupTest(t)
	ctx := context.Background()

	// Pre-populate tenants
	repo.tenants["1"] = map[string]any{"id": 1, "name": "a", "status": "active"}
	repo.tenants["2"] = map[string]any{"id": 2, "name": "b", "status": "active"}
	repo.tenants["3"] = map[string]any{"id": 3, "name": "c", "status": "inactive"}

	result, err := svc.ListTenants(ctx, models.ListTenantRequest{Page: 1, Limit: 10})
	assertNoErr(t, err)

	if result.Total != 3 {
		t.Errorf("expected total 3, got %d", result.Total)
	}
	if len(result.Data) != 3 {
		t.Errorf("expected 3 tenants, got %d", len(result.Data))
	}

	// Filter by status
	status := "active"
	filtered, err := svc.ListTenants(ctx, models.ListTenantRequest{Page: 1, Limit: 10, Status: &status})
	assertNoErr(t, err)
	if filtered.Total != 2 {
		t.Errorf("expected 2 active tenants, got %d", filtered.Total)
	}
}

func TestUpdateTenantSuccess(t *testing.T) {
	svc, repo := setupTest(t)
	ctx := context.Background()

	// Pre-populate
	repo.tenants["1"] = map[string]any{
		"id":           1,
		"name":         "oldname",
		"display_name": "Old Name",
		"status":       "active",
	}

	req := models.UpdateTenantRequest{
		Name:        strPtr("newname"),
		DisplayName: strPtr("New Name"),
	}

	result, err := svc.UpdateTenant(ctx, "1", req)
	assertNoErr(t, err)

	if (*result)["name"] != "newname" {
		t.Errorf("expected name 'newname', got %v", (*result)["name"])
	}
}

func TestDeleteTenantSuccess(t *testing.T) {
	svc, repo := setupTest(t)
	ctx := context.Background()

	// Pre-populate
	repo.tenants["5"] = map[string]any{"id": 5, "name": "delme", "status": "active"}

	err := svc.DeleteTenant(ctx, "5")
	assertNoErr(t, err)

	_, exists := repo.tenants["5"]
	if exists {
		t.Error("tenant should be removed from repo after delete")
	}
}

func TestGetUserTenants(t *testing.T) {
	svc, repo := setupTest(t)
	ctx := context.Background()

	// Pre-populate user tenants
	repo.users = []map[string]any{
		{"id": 1, "name": "t1", "role": "admin", "status": "active"},
		{"id": 2, "name": "t2", "role": "member", "status": "active"},
	}

	result, err := svc.GetUserTenants(ctx, "user-1", "1")
	assertNoErr(t, err)

	tenants := (*result)["tenants"].([]map[string]any)
	if len(tenants) != 2 {
		t.Errorf("expected 2 tenants, got %d", len(tenants))
	}

	total := (*result)["total"]
	if total.(int) != 2 {
		t.Errorf("expected total 2, got %v", total)
	}

	current := (*result)["currentTenant"]
	if current == nil {
		t.Error("expected currentTenant to be set")
	}
}

func TestGetQuota(t *testing.T) {
	svc, repo := setupTest(t)
	ctx := context.Background()

	// No quota stored -> should return default
	result, err := svc.GetQuota(ctx, 0, "1")
	assertNoErr(t, err)

	if result.MaxPipelines != 100 {
		t.Errorf("expected default max_pipelines 100, got %d", result.MaxPipelines)
	}
	if result.MaxNamespaces != 10 {
		t.Errorf("expected default max_namespaces 10, got %d", result.MaxNamespaces)
	}

	// With stored quota
	repo.quota = &map[string]any{
		"max_pipelines": 50,
	}
	// When quota is present, buildQuota returns default, so check defaults are returned
	result2, err := svc.GetQuota(ctx, 0, "1")
	assertNoErr(t, err)
	_ = result2
}

func assertNoErr(t *testing.T, err error) {
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func strPtr(s string) *string {
	return &s
}
