package sso

import (
	"context"
	"fmt"
	"testing"
	"time"
)

// mockHRSyncStore implements HRSyncStore for testing.
type mockHRSyncStore struct {
	users map[string]*HRUser // key: tenantID:employeeID
}

func newMockHRSyncStore() *mockHRSyncStore {
	return &mockHRSyncStore{users: make(map[string]*HRUser)}
}

func (s *mockHRSyncStore) UpsertUser(ctx context.Context, user *HRUser) error {
	key := user.TenantID + ":" + user.EmployeeID
	s.users[key] = user
	return nil
}

func (s *mockHRSyncStore) DisableUser(ctx context.Context, tenantID, employeeID string) error {
	key := tenantID + ":" + employeeID
	if u, ok := s.users[key]; ok {
		u.Status = "terminated"
	}
	return nil
}

func (s *mockHRSyncStore) GetUserByEmployeeID(ctx context.Context, tenantID, employeeID string) (*HRUser, error) {
	key := tenantID + ":" + employeeID
	if u, ok := s.users[key]; ok {
		return u, nil
	}
	return nil, fmt.Errorf("not found")
}

func (s *mockHRSyncStore) ListActiveUsers(ctx context.Context, tenantID string) ([]*HRUser, error) {
	var result []*HRUser
	for _, u := range s.users {
		if u.TenantID == tenantID && u.Status == "active" {
			result = append(result, u)
		}
	}
	return result, nil
}

// mockHREventNotifier implements HREventNotifier for testing.
type mockHREventNotifier struct {
	newEmployees  []*HRUser
	transfers     []*HRUser
	terminations  []*HRUser
}

func (n *mockHREventNotifier) NotifyNewEmployee(ctx context.Context, user *HRUser) error {
	n.newEmployees = append(n.newEmployees, user)
	return nil
}

func (n *mockHREventNotifier) NotifyTransfer(ctx context.Context, user *HRUser, oldDept, newDept string) error {
	n.transfers = append(n.transfers, user)
	return nil
}

func (n *mockHREventNotifier) NotifyTermination(ctx context.Context, user *HRUser) error {
	n.terminations = append(n.terminations, user)
	return nil
}

func TestHRSyncEngine_NewEmployee(t *testing.T) {
	store := newMockHRSyncStore()
	notifier := &mockHREventNotifier{}
	engine := NewHRSyncEngine(store, notifier, HRSyncConfig{})

	users := []*HRUser{
		{
			EmployeeID: "E001",
			TenantID:   "t1",
			Username:   "alice",
			Email:      "alice@example.com",
			Name:       "Alice Wang",
			Department: "Engineering",
			Status:     "active",
		},
	}

	result, err := engine.Sync(context.Background(), users)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Created != 1 {
		t.Errorf("expected 1 created, got %d", result.Created)
	}
	if result.Processed != 1 {
		t.Errorf("expected 1 processed, got %d", result.Processed)
	}
	if len(notifier.newEmployees) != 1 {
		t.Errorf("expected 1 new employee notification, got %d", len(notifier.newEmployees))
	}

	// Verify user was stored with default role
	key := "t1:E001"
	if store.users[key].Role != "viewer" {
		t.Errorf("expected default role=viewer, got %s", store.users[key].Role)
	}
}

func TestHRSyncEngine_Termination(t *testing.T) {
	store := newMockHRSyncStore()
	notifier := &mockHREventNotifier{}
	engine := NewHRSyncEngine(store, notifier, HRSyncConfig{
		DisableOnTermination: true,
	})

	// Pre-create user
	store.users["t1:E001"] = &HRUser{
		EmployeeID: "E001",
		TenantID:   "t1",
		Username:   "alice",
		Status:     "active",
	}

	users := []*HRUser{
		{
			EmployeeID: "E001",
			TenantID:   "t1",
			Username:   "alice",
			Status:     "terminated",
		},
	}

	result, err := engine.Sync(context.Background(), users)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Disabled != 1 {
		t.Errorf("expected 1 disabled, got %d", result.Disabled)
	}
	if len(notifier.terminations) != 1 {
		t.Errorf("expected 1 termination notification, got %d", len(notifier.terminations))
	}
	if store.users["t1:E001"].Status != "terminated" {
		t.Errorf("expected user status=terminated, got %s", store.users["t1:E001"].Status)
	}
}

func TestHRSyncEngine_Transfer(t *testing.T) {
	store := newMockHRSyncStore()
	notifier := &mockHREventNotifier{}
	engine := NewHRSyncEngine(store, notifier, HRSyncConfig{})

	// Pre-create user in Engineering
	store.users["t1:E001"] = &HRUser{
		EmployeeID: "E001",
		TenantID:   "t1",
		Username:   "alice",
		Department: "Engineering",
		Status:     "active",
	}

	// Transfer to Platform
	users := []*HRUser{
		{
			EmployeeID: "E001",
			TenantID:   "t1",
			Username:   "alice",
			Department: "Platform",
			Status:     "active",
		},
	}

	result, err := engine.Sync(context.Background(), users)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Updated != 1 {
		t.Errorf("expected 1 updated, got %d", result.Updated)
	}
	if len(notifier.transfers) != 1 {
		t.Errorf("expected 1 transfer notification, got %d", len(notifier.transfers))
	}
}

func TestHRSyncEngine_MixedBatch(t *testing.T) {
	store := newMockHRSyncStore()
	notifier := &mockHREventNotifier{}
	engine := NewHRSyncEngine(store, notifier, HRSyncConfig{
		DisableOnTermination: true,
	})

	// Pre-create one user
	store.users["t1:E002"] = &HRUser{
		EmployeeID: "E002",
		TenantID:   "t1",
		Username:   "bob",
		Department: "Engineering",
		Status:     "active",
	}

	users := []*HRUser{
		{EmployeeID: "E001", TenantID: "t1", Username: "alice", Status: "active"},
		{EmployeeID: "E002", TenantID: "t1", Username: "bob", Department: "Platform", Status: "active"},
		{EmployeeID: "E002", TenantID: "t1", Username: "bob", Status: "terminated"},
	}

	result, err := engine.Sync(context.Background(), users)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// E001: new, E002: transfer then terminate
	if result.Created != 1 {
		t.Errorf("expected 1 created, got %d", result.Created)
	}
	if result.Disabled != 1 {
		t.Errorf("expected 1 disabled, got %d", result.Disabled)
	}
}

func TestHRSyncEngine_DefaultConfig(t *testing.T) {
	engine := NewHRSyncEngine(nil, nil, HRSyncConfig{})

	if engine.config.SyncInterval != 1*time.Hour {
		t.Errorf("expected default sync interval=1h, got %v", engine.config.SyncInterval)
	}
	if engine.config.DefaultRole != "viewer" {
		t.Errorf("expected default role=viewer, got %s", engine.config.DefaultRole)
	}
	if engine.config.DefaultStatus != "active" {
		t.Errorf("expected default status=active, got %s", engine.config.DefaultStatus)
	}
}

func TestHRSyncEngine_NilNotifier(t *testing.T) {
	store := newMockHRSyncStore()
	engine := NewHRSyncEngine(store, nil, HRSyncConfig{})

	users := []*HRUser{
		{EmployeeID: "E001", TenantID: "t1", Username: "alice", Status: "active"},
	}

	// Should not panic with nil notifier
	result, err := engine.Sync(context.Background(), users)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Created != 1 {
		t.Errorf("expected 1 created, got %d", result.Created)
	}
}

func TestHRSyncEngine_NoDisableOnTermination(t *testing.T) {
	store := newMockHRSyncStore()
	notifier := &mockHREventNotifier{}
	engine := NewHRSyncEngine(store, notifier, HRSyncConfig{
		DisableOnTermination: false,
	})

	store.users["t1:E001"] = &HRUser{
		EmployeeID: "E001",
		TenantID:   "t1",
		Username:   "alice",
		Status:     "active",
	}

	users := []*HRUser{
		{EmployeeID: "E001", TenantID: "t1", Username: "alice", Status: "terminated"},
	}

	result, err := engine.Sync(context.Background(), users)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Disabled counts termination events processed (not actual disable operations)
	if result.Disabled != 1 {
		t.Errorf("expected 1 disabled (termination event), got %d", result.Disabled)
	}
	// Termination notification should still be sent
	if len(notifier.terminations) != 1 {
		t.Errorf("expected 1 termination notification, got %d", len(notifier.terminations))
	}
	// User status should NOT be changed since DisableOnTermination is false
	if store.users["t1:E001"].Status != "active" {
		t.Errorf("expected user status=active with DisableOnTermination=false, got %s", store.users["t1:E001"].Status)
	}
}
