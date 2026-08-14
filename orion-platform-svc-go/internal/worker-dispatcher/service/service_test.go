package service_test

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"orion/platform-svc-go/internal/worker-dispatcher/models"
	"orion/platform-svc-go/internal/worker-dispatcher/service"
)

// -----------------------------------------------------------------------------
// fakeWorkerRepo  implements service.RepositoryInterface with in-memory storage
// so service tests can run without PostgreSQL.
// -----------------------------------------------------------------------------

type fakeWorkerRepo struct {
	mu          sync.RWMutex
	policies    map[string]*models.WorkerPolicy // key = tenantID + ":" + id
	nextID      int
	lastUpdateKey   string
	lastUpdateMap   map[string]interface{}
}

func newFakeRepo() *fakeWorkerRepo {
	return &fakeWorkerRepo{policies: make(map[string]*models.WorkerPolicy), nextID: 1}
}

func (r *fakeWorkerRepo) policyKey(tenantID, id string) string {
	return tenantID + ":" + id
}

func (r *fakeWorkerRepo) CreatePolicy(ctx context.Context, m *models.WorkerPolicy) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if m.ID == "" {
		m.ID = fmt.Sprintf("policy-%d", r.nextID)
		r.nextID++
	}
	r.policies[r.policyKey(m.TenantID, m.ID)] = m
	return nil
}

func (r *fakeWorkerRepo) GetPolicy(ctx context.Context, tenantID, id string) (*models.WorkerPolicy, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, ok := r.policies[r.policyKey(tenantID, id)]
	if !ok {
		return nil, fmt.Errorf("policy not found: %s", id)
	}
	return p, nil
}

func (r *fakeWorkerRepo) ListPolicies(ctx context.Context, tenantID, policyType, enabled string, limit, offset int) ([]models.WorkerPolicy, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var out []models.WorkerPolicy
	for _, p := range r.policies {
		if p.TenantID != tenantID {
			continue
		}
		if policyType != "" && p.Type != policyType {
			continue
		}
		if enabled != "" {
			eBool := enabled == "true"
			if p.Enabled != eBool {
				continue
			}
		}
		out = append(out, *p)
	}
	return out, nil
}

func (r *fakeWorkerRepo) UpdatePolicy(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := r.policyKey(tenantID, id)
	p, ok := r.policies[key]
	if !ok {
		return fmt.Errorf("policy not found: %s", id)
	}
	if name, ok := updates["name"]; ok {
		p.Name = name.(string)
	}
	if typ, ok := updates["type"]; ok {
		p.Type = typ.(string)
	}
	if cfg, ok := updates["config"]; ok {
		p.Config = cfg.(string)
	}
	if prio, ok := updates["priority"]; ok {
		p.Priority = prio.(int)
	}
	if en, ok := updates["enabled"]; ok {
		p.Enabled = en.(bool)
	}
	r.lastUpdateKey = key
	r.lastUpdateMap = updates
	return nil
}

func (r *fakeWorkerRepo) DeletePolicy(ctx context.Context, tenantID, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.policies, r.policyKey(tenantID, id))
	return nil
}

func (r *fakeWorkerRepo) CreateAssignment(ctx context.Context, m *models.WorkerAssignment) error    { return nil }
func (r *fakeWorkerRepo) GetAssignment(ctx context.Context, tenantID, targetID string) (*models.WorkerAssignment, error) {
	return nil, nil
}
func (r *fakeWorkerRepo) GetAssignmentByID(ctx context.Context, tenantID, id string) (*models.WorkerAssignment, error) {
	return nil, nil
}
func (r *fakeWorkerRepo) UpdateAssignmentStatus(ctx context.Context, tenantID, id, status string, completedAt interface{}) error {
	return nil
}
func (r *fakeWorkerRepo) GetActiveAssignments(ctx context.Context, tenantID, workerID string) int {
	return 0
}
func (r *fakeWorkerRepo) CreateCapability(ctx context.Context, m *models.WorkerCapability) error    { return nil }
func (r *fakeWorkerRepo) GetCapabilities(ctx context.Context, tenantID string) ([]models.WorkerCapability, error) {
	return nil, nil
}
func (r *fakeWorkerRepo) GetCapabilitiesByWorker(ctx context.Context, tenantID, workerID string) ([]models.WorkerCapability, error) {
	return nil, nil
}
func (r *fakeWorkerRepo) DeleteCapability(ctx context.Context, tenantID, workerID, skill string) error {
	return nil
}
func (r *fakeWorkerRepo) GetEnabledPolicies(ctx context.Context, tenantID, policyType string) ([]models.WorkerPolicy, error) {
	return nil, nil
}
func (r *fakeWorkerRepo) ListAssignmentsByWorker(ctx context.Context, tenantID, workerID string) ([]models.WorkerAssignment, error) {
	return nil, nil
}

// Compile-time check that fakeWorkerRepo satisfies RepositoryInterface.
var _ service.RepositoryInterface = (*fakeWorkerRepo)(nil)

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

func TestService_NewService(t *testing.T) {
	s := service.NewService(newFakeRepo())
	if s == nil {
		t.Fatal("NewService returned nil")
	}
}

func TestService_NewServiceWithLogger(t *testing.T) {
	s := service.NewServiceWithLogger(newFakeRepo(), nil)
	if s == nil {
		t.Fatal("NewServiceWithLogger returned nil")
	}
}

func TestService_CreatePolicy(t *testing.T) {
	repo := newFakeRepo()
	s := service.NewService(repo)
	ctx := context.Background()

	req := models.CreatePolicyRequest{
		Name:     "my-policy",
		Type:     "round_robin",
		Config:   `{"timeout": 30}`,
		Priority: 10,
		Enabled:  true,
	}
	got, err := s.CreatePolicy(ctx, "t1", req)
	if err != nil {
		t.Fatalf("CreatePolicy returned error: %v", err)
	}
	if got == nil {
		t.Fatal("CreatePolicy returned nil policy")
	}
	if got.Name != "my-policy" {
		t.Fatalf("expected name 'my-policy', got '%s'", got.Name)
	}
	if got.Type != "round_robin" {
		t.Fatalf("expected type 'round_robin', got '%s'", got.Type)
	}
	if got.Config != `{"timeout": 30}` {
		t.Fatalf("unexpected config: %q", got.Config)
	}
	if got.Priority != 10 {
		t.Fatalf("expected priority 10, got %d", got.Priority)
	}
	if got.Enabled != true {
		t.Fatal("expected Enabled=true")
	}
	if got.TenantID != "t1" {
		t.Fatalf("expected TenantID 't1', got '%s'", got.TenantID)
	}

	// Verify the repo received the policy.
	_, err = repo.GetPolicy(ctx, "t1", got.ID)
	if err != nil {
		t.Fatalf("policy was not persisted: %v", err)
	}
}

func TestService_CreatePolicy_WithNilRepoError(t *testing.T) {
	// A failing repo propagates the error.
	repo := &failingRepo{createErr: fmt.Errorf("disk full")}
	s := service.NewService(repo)
	req := models.CreatePolicyRequest{Name: "x", Type: "y"}
	got, err := s.CreatePolicy(context.Background(), "t1", req)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if got != nil {
		t.Fatal("expected nil policy on error")
	}
}

func TestService_GetPolicy(t *testing.T) {
	repo := newFakeRepo()
	s := service.NewService(repo)
	ctx := context.Background()

	// Seed a policy through the service.
	created, err := s.CreatePolicy(ctx, "t1", models.CreatePolicyRequest{
		Name: "getme", Type: "skill_match", Enabled: true,
	})
	if err != nil {
		t.Fatalf("seed failed: %v", err)
	}

	got, err := s.GetPolicy(ctx, "t1", created.ID)
	if err != nil {
		t.Fatalf("GetPolicy returned error: %v", err)
	}
	if got == nil {
		t.Fatal("GetPolicy returned nil")
	}
	if got.Name != "getme" {
		t.Fatalf("expected name 'getme', got '%s'", got.Name)
	}

	// Not-found path.
	_, err = s.GetPolicy(ctx, "t1", "nonexistent")
	if err == nil {
		t.Fatal("expected error for missing policy, got nil")
	}
}

func TestService_ListPolicies(t *testing.T) {
	repo := newFakeRepo()
	s := service.NewService(repo)
	ctx := context.Background()

	// Seed three policies.
	for _, pr := range []models.CreatePolicyRequest{
		{Name: "p1", Type: "round_robin", Enabled: true},
		{Name: "p2", Type: "skill_match", Enabled: true},
		{Name: "p3", Type: "round_robin", Enabled: false},
	} {
		if _, err := s.CreatePolicy(ctx, "t1", pr); err != nil {
			t.Fatalf("seed failed: %v", err)
		}
	}

	// List all for tenant.
	all, err := s.ListPolicies(ctx, "t1", "", "", 0, 0)
	if err != nil {
		t.Fatalf("ListPolicies returned error: %v", err)
	}
	if len(all) != 3 {
		t.Fatalf("expected 3 policies, got %d", len(all))
	}

	// Filter by type.
	filtered, err := s.ListPolicies(ctx, "t1", "skill_match", "", 0, 0)
	if err != nil {
		t.Fatalf("ListPolicies by type returned error: %v", err)
	}
	if len(filtered) != 1 {
		t.Fatalf("expected 1 skill_match policy, got %d", len(filtered))
	}
	if filtered[0].Name != "p2" {
		t.Fatalf("expected name 'p2', got '%s'", filtered[0].Name)
	}

	// Filter by enabled.
	enabled, err := s.ListPolicies(ctx, "t1", "", "true", 0, 0)
	if err != nil {
		t.Fatalf("ListPolicies by enabled returned error: %v", err)
	}
	if len(enabled) != 2 {
		t.Fatalf("expected 2 enabled policies, got %d", len(enabled))
	}

	// Empty tenant.
	empty, err := s.ListPolicies(ctx, "t999", "", "", 0, 0)
	if err != nil {
		t.Fatalf("ListPolicies returned error: %v", err)
	}
	if len(empty) != 0 {
		t.Fatalf("expected 0 policies for unknown tenant, got %d", len(empty))
	}
}

func TestService_UpdatePolicy_UpdateFields(t *testing.T) {
	repo := newFakeRepo()
	s := service.NewService(repo)
	ctx := context.Background()

	created, err := s.CreatePolicy(ctx, "t1", models.CreatePolicyRequest{
		Name: "orig", Type: "round_robin", Priority: 1, Enabled: true,
	})
	if err != nil {
		t.Fatalf("seed failed: %v", err)
	}

	newName := "updated-name"
	newType := "skill_match"
	newPrio := 5
	newEnabled := false
	_, err = s.UpdatePolicy(ctx, "t1", created.ID, models.UpdatePolicyRequest{
		Name:     &newName,
		Type:     &newType,
		Priority: &newPrio,
		Enabled:  &newEnabled,
	})
	if err != nil {
		t.Fatalf("UpdatePolicy returned error: %v", err)
	}

	got, err := s.GetPolicy(ctx, "t1", created.ID)
	if err != nil {
		t.Fatalf("GetPolicy after update returned error: %v", err)
	}
	if got.Name != newName {
		t.Fatalf("expected name '%s', got '%s'", newName, got.Name)
	}
	if got.Type != newType {
		t.Fatalf("expected type '%s', got '%s'", newType, got.Type)
	}
	if got.Priority != newPrio {
		t.Fatalf("expected priority %d, got %d", newPrio, got.Priority)
	}
	if got.Enabled != newEnabled {
		t.Fatalf("expected Enabled false, got %v", got.Enabled)
	}

	// Verify the fake repo captured the update map.
	repo.mu.RLock()
	defer repo.mu.RUnlock()
	if len(repo.lastUpdateMap) != 4 {
		t.Fatalf("expected 4 updated fields, got %d", len(repo.lastUpdateMap))
	}
}

func TestService_UpdatePolicy_EmptyUpdates_GetOnly(t *testing.T) {
	repo := newFakeRepo()
	s := service.NewService(repo)
	ctx := context.Background()

	created, err := s.CreatePolicy(ctx, "t1", models.CreatePolicyRequest{
		Name: "unchanged", Type: "weight", Priority: 7, Enabled: false,
	})
	if err != nil {
		t.Fatalf("seed failed: %v", err)
	}

	// No fields provided => should just return current policy, not touch the repo.
	got, err := s.UpdatePolicy(ctx, "t1", created.ID, models.UpdatePolicyRequest{})
	if err != nil {
		t.Fatalf("UpdatePolicy with empty request returned error: %v", err)
	}
	if got.Name != "unchanged" || got.Type != "weight" || got.Priority != 7 {
		t.Fatal("policy changed unexpectedly with empty update")
	}
}

func TestService_UpdatePolicy_NotFound(t *testing.T) {
	repo := newFakeRepo()
	s := service.NewService(repo)
	ctx := context.Background()

	newName := "nope"
	_, err := s.UpdatePolicy(ctx, "t1", "missing", models.UpdatePolicyRequest{
		Name: &newName,
	})
	if err == nil {
		t.Fatal("expected error for missing policy, got nil")
	}
}

// TestService_DeletePolicy_viaRepo verifies the repository DeletePolicy method
// directly since WorkerDispatcher does not expose a public DeletePolicy method.
func TestService_DeletePolicy_viaRepo(t *testing.T) {
	repo := newFakeRepo()
	s := service.NewService(repo)
	ctx := context.Background()

	created, err := s.CreatePolicy(ctx, "t1", models.CreatePolicyRequest{
		Name: "todelete", Type: "custom",
	})
	if err != nil {
		t.Fatalf("seed failed: %v", err)
	}

	err = repo.DeletePolicy(ctx, "t1", created.ID)
	if err != nil {
		t.Fatalf("DeletePolicy returned error: %v", err)
	}

	// Verify it is gone via the service.
	_, err = s.GetPolicy(ctx, "t1", created.ID)
	if err == nil {
		t.Fatal("expected error after deletion, got nil")
	}
}

func TestService_RegisterHandler(t *testing.T) {
	s := service.NewService(newFakeRepo())
	h := &stubHandler{name: "custom_handler"}
	s.RegisterHandler(h)
	// Just ensure it doesn't panic — dispatchers map is populated.
	_, _ = s.Dispatch(context.Background(), "t1", "ticket", "1", "round_robin", nil)
}

// --- helpers ---

type stubHandler struct {
	name string
}

func (h *stubHandler) Name() string       { return h.name }
func (h *stubHandler) Match(w *models.WorkerCapability, t map[string]interface{}) bool {
	return true
}
func (h *stubHandler) Score(w *models.WorkerCapability, t map[string]interface{}) int {
	return 1
}

// failingRepo satisfies RepositoryInterface but always returns an error on CreatePolicy.
type failingRepo struct {
	createErr error
}

func (r *failingRepo) CreatePolicy(ctx context.Context, m *models.WorkerPolicy) error { return r.createErr }
func (r *failingRepo) GetPolicy(ctx context.Context, tenantID, id string) (*models.WorkerPolicy, error) {
	return nil, nil
}
func (r *failingRepo) ListPolicies(ctx context.Context, tenantID, policyType, enabled string, limit, offset int) ([]models.WorkerPolicy, error) {
	return nil, nil
}
func (r *failingRepo) UpdatePolicy(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	return nil
}
func (r *failingRepo) DeletePolicy(ctx context.Context, tenantID, id string) error { return nil }
func (r *failingRepo) CreateAssignment(ctx context.Context, m *models.WorkerAssignment) error { return nil }
func (r *failingRepo) GetAssignment(ctx context.Context, tenantID, targetID string) (*models.WorkerAssignment, error) {
	return nil, nil
}
func (r *failingRepo) GetAssignmentByID(ctx context.Context, tenantID, id string) (*models.WorkerAssignment, error) {
	return nil, nil
}
func (r *failingRepo) UpdateAssignmentStatus(ctx context.Context, tenantID, id, status string, completedAt interface{}) error {
	return nil
}
func (r *failingRepo) GetActiveAssignments(ctx context.Context, tenantID, workerID string) int { return 0 }
func (r *failingRepo) CreateCapability(ctx context.Context, m *models.WorkerCapability) error { return nil }
func (r *failingRepo) GetCapabilities(ctx context.Context, tenantID string) ([]models.WorkerCapability, error) {
	return nil, nil
}
func (r *failingRepo) GetCapabilitiesByWorker(ctx context.Context, tenantID, workerID string) ([]models.WorkerCapability, error) {
	return nil, nil
}
func (r *failingRepo) DeleteCapability(ctx context.Context, tenantID, workerID, skill string) error { return nil }
func (r *failingRepo) GetEnabledPolicies(ctx context.Context, tenantID, policyType string) ([]models.WorkerPolicy, error) {
	return nil, nil
}
func (r *failingRepo) ListAssignmentsByWorker(ctx context.Context, tenantID, workerID string) ([]models.WorkerAssignment, error) {
	return nil, nil
}

var _ service.RepositoryInterface = (*failingRepo)(nil)
