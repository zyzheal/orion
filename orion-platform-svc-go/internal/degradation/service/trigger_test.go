package service

import (
	"context"
	"errors"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/degradation/models"
	"orion/platform-svc-go/internal/degradation/repository"
)

// mockTriggerRepo implements TriggerRepositoryInterface for testing.
type mockTriggerRepo struct {
	triggers map[string]*models.DegradationTrigger // tenant+policy → active trigger
	actions  map[string]models.DegradationAction    // id → action
	actionID string                                 // generated action ID
	err      error                                  // injectable error
}

func (m *mockTriggerRepo) CreateTrigger(_ context.Context, t *models.DegradationTrigger) error {
	if m.err != nil {
		return m.err
	}
	key := t.TenantID + "|" + t.PolicyID
	m.triggers[key] = t
	return nil
}
func (m *mockTriggerRepo) GetActiveTrigger(_ context.Context, tenantID, policyID string) (*models.DegradationTrigger, error) {
	if m.err != nil {
		return nil, m.err
	}
	key := tenantID + "|" + policyID
	t, ok := m.triggers[key]
	if !ok {
		return nil, repository.ErrNoTriggers
	}
	return t, nil
}
func (m *mockTriggerRepo) ListActionsByTrigger(_ context.Context, tenantID, triggerID string) ([]models.DegradationAction, error) {
	if m.err != nil {
		return nil, m.err
	}
	var out []models.DegradationAction
	for _, a := range m.actions {
		if a.TriggerID == triggerID && a.TenantID == tenantID {
			out = append(out, a)
		}
	}
	return out, nil
}
func (m *mockTriggerRepo) CountTriggersByPolicy(_ context.Context, tenantID, policyID string) (int, error) {
	key := tenantID + "|" + policyID
	_, ok := m.triggers[key]
	if ok {
		return 1, nil
	}
	return 0, nil
}
func (m *mockTriggerRepo) CreateAction(_ context.Context, a *models.DegradationAction) error {
	if m.err != nil {
		return m.err
	}
	if a.ID == "" {
		m.actionID = "a-" + a.TriggerID
	}
	if m.actionID != "" {
		a.ID = m.actionID
	}
	m.actions[a.ID] = *a
	return nil
}
func (m *mockTriggerRepo) RevertAction(_ context.Context, tenantID, actionID string) error {
	a, ok := m.actions[actionID]
	if !ok {
		return sentinel.NotFound
	}
	if a.TenantID != tenantID {
		return sentinel.NotFound
	}
	a.Status = "reverted"
	m.actions[actionID] = a
	return nil
}

type mockRepo struct{}

func (m *mockRepo) Create(_ context.Context, _ *models.Degradation) error          { return nil }
func (m *mockRepo) Delete(_ context.Context, _, _ string) (bool, error)             { return true, nil }
func (m *mockRepo) GetByID(_ context.Context, _, _ string) (*models.Degradation, error) { return nil, sentinel.NotFound }
func (m *mockRepo) List(_ context.Context, _ string) ([]models.Degradation, error) { return nil, nil }
func (m *mockRepo) Update(_ context.Context, _, _ string, _ map[string]interface{}) (*models.Degradation, error) { return nil, sentinel.NotFound }

var _ TriggerRepositoryInterface = (*mockTriggerRepo)(nil)

func newTestService() *Service {
	return NewService(&mockRepo{}, &mockTriggerRepo{
		triggers: make(map[string]*models.DegradationTrigger),
		actions:  make(map[string]models.DegradationAction),
	})
}

func TestTriggerDegradation_OK(t *testing.T) {
	svc := newTestService()
	req := &models.TriggerRequest{PolicyID: "pol-1", Reason: "latency too high", LatencyMs: 800}

	status, err := svc.TriggerDegradation(context.Background(), "t1", req)
	if err != nil {
		t.Fatalf("TriggerDegradation failed: %v", err)
	}
	if !status.IsDegraded {
		t.Error("expected IsDegraded=true")
	}
	if status.ActiveTrigger == nil {
		t.Error("expected non-nil ActiveTrigger")
	}

	// Verify it's persisted as active.
	active, err := svc.triggerRepo.GetActiveTrigger(context.Background(), "t1", "pol-1")
	if err != nil {
		t.Fatalf("GetActiveTrigger failed: %v", err)
	}
	if active.Status != "active" {
		t.Errorf("Status = %s, want active", active.Status)
	}
}

func TestTriggerDegradation_AlreadyActive(t *testing.T) {
	trigRepo := &mockTriggerRepo{
		triggers: make(map[string]*models.DegradationTrigger),
		actions:  make(map[string]models.DegradationAction),
	}
	svc := NewService(&mockRepo{}, trigRepo)

	// Pre-populate an active trigger.
	trigRepo.triggers["t1|pol-1"] = &models.DegradationTrigger{
		Status: "active",
	}

	_, err := svc.TriggerDegradation(context.Background(), "t1",
		&models.TriggerRequest{PolicyID: "pol-1", Reason: "retry"})
	if !errors.Is(err, ErrAlreadyActive) {
		t.Fatalf("expected ErrAlreadyActive, got: %v", err)
	}
}

func TestTriggerDegradation_BadRequest(t *testing.T) {
	svc := newTestService()
	_, err := svc.TriggerDegradation(context.Background(), "t1",
		&models.TriggerRequest{PolicyID: "pol-1"}) // missing Reason
	if !errors.Is(err, ErrBadRequest) {
		t.Fatalf("expected ErrBadRequest, got: %v", err)
	}
	_, err = svc.TriggerDegradation(context.Background(), "t1", nil)
	if !errors.Is(err, ErrBadRequest) {
		t.Fatalf("expected ErrBadRequest for nil, got: %v", err)
	}
}

func TestTriggerDegradation_CreateError(t *testing.T) {
	trigRepo := &mockTriggerRepo{
		triggers: make(map[string]*models.DegradationTrigger),
		actions:  make(map[string]models.DegradationAction),
		err:      errors.New("db down"),
	}
	svc := NewService(&mockRepo{}, trigRepo)

	_, err := svc.TriggerDegradation(context.Background(), "t1",
		&models.TriggerRequest{PolicyID: "pol-1", Reason: "error"})
	if !errors.Is(err, trigRepo.err) {
		t.Fatalf("expected db error, got: %v", err)
	}
}

func TestGetStatus_NoActiveTrigger(t *testing.T) {
	svc := newTestService()

	status, err := svc.GetStatus(context.Background(), "t1", "pol-1")
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}
	if status.IsDegraded {
		t.Error("expected IsDegraded=false when no active trigger")
	}
}

func TestGetStatus_ActiveTrigger(t *testing.T) {
	trigRepo := &mockTriggerRepo{
		triggers: make(map[string]*models.DegradationTrigger),
		actions:  make(map[string]models.DegradationAction),
	}
	svc := NewService(&mockRepo{}, trigRepo)

	// Pre-insert active trigger + action.
	trigRepo.triggers["t1|pol-1"] = &models.DegradationTrigger{
		ID:        "tr-1",
		Status:    "active",
		ErrorRate: 0.12,
		LatencyMs: 900,
	}
	trigRepo.actionID = "a-tr-1"
	trigRepo.actions["a-tr-1"] = models.DegradationAction{
		ID:        "a-tr-1",
		TriggerID: "tr-1",
		TenantID:  "t1",
		Action:    "degrade_response",
		Status:    "applied",
	}

	status, err := svc.GetStatus(context.Background(), "t1", "pol-1")
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}
	if !status.IsDegraded {
		t.Error("expected IsDegraded=true")
	}
	if status.CurrentErrorRate != 0.12 {
		t.Errorf("ErrorRate = %f, want 0.12", status.CurrentErrorRate)
	}
	if len(status.Actions) != 1 {
		t.Errorf("Actions count = %d, want 1", len(status.Actions))
	}
}

func TestGetStatus_BadRequest(t *testing.T) {
	svc := newTestService()
	_, err := svc.GetStatus(context.Background(), "t1", "")
	if !errors.Is(err, ErrBadRequest) {
		t.Fatalf("expected ErrBadRequest, got: %v", err)
	}
}

func TestGetStatus_TriggerRepoNil(t *testing.T) {
	svc := &Service{repo: &mockRepo{}, triggerRepo: nil}

	status, err := svc.GetStatus(context.Background(), "t1", "pol-1")
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}
	if status.IsDegraded {
		t.Error("expected IsDegraded=false when triggerRepo is nil")
	}
}

func TestResolve_OK(t *testing.T) {
	trigRepo := &mockTriggerRepo{
		triggers: make(map[string]*models.DegradationTrigger),
		actions:  make(map[string]models.DegradationAction),
	}
	svc := NewService(&mockRepo{}, trigRepo)

	// Pre-insert active trigger + action.
	trigRepo.triggers["t1|pol-1"] = &models.DegradationTrigger{
		ID:     "tr-1",
		Status: "active",
	}
	trigRepo.actionID = "a-tr-1"
	trigRepo.actions["a-tr-1"] = models.DegradationAction{
		ID:        "a-tr-1",
		TriggerID: "tr-1",
		TenantID:  "t1",
		Status:    "applied",
	}

	status, err := svc.Resolve(context.Background(), "t1", "pol-1",
		&models.ResolveRequest{ResolvedBy: "admin"})
	if err != nil {
		t.Fatalf("Resolve failed: %v", err)
	}
	if status.IsDegraded {
		t.Error("expected IsDegraded=false after resolve")
	}
	if status.ActiveTrigger.Status != "resolved" {
		t.Errorf("trigger Status = %s, want resolved", status.ActiveTrigger.Status)
	}
	// Action should be reverted.
	if len(status.Actions) != 1 || status.Actions[0].Status != "reverted" {
		t.Errorf("expected action reverted, got: %v", status.Actions)
	}
}

func TestResolve_NotActive(t *testing.T) {
	svc := newTestService()
	_, err := svc.Resolve(context.Background(), "t1", "pol-1",
		&models.ResolveRequest{ResolvedBy: "admin"})
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("expected sentinel.NotFound, got: %v", err)
	}
}

func TestResolve_BadRequest(t *testing.T) {
	svc := newTestService()
	_, err := svc.Resolve(context.Background(), "t1", "",
		&models.ResolveRequest{ResolvedBy: "admin"})
	if !errors.Is(err, ErrBadRequest) {
		t.Fatalf("expected ErrBadRequest for empty policyID, got: %v", err)
	}
	_, err = svc.Resolve(context.Background(), "t1", "pol-1", nil)
	if !errors.Is(err, ErrBadRequest) {
		t.Fatalf("expected ErrBadRequest for nil req, got: %v", err)
	}
}

func TestResolve_TriggerRepoNil(t *testing.T) {
	svc := &Service{repo: &mockRepo{}, triggerRepo: nil}
	status, err := svc.Resolve(context.Background(), "t1", "pol-1",
		&models.ResolveRequest{ResolvedBy: "admin"})
	if err != nil {
		t.Fatalf("Resolve failed with nil triggerRepo: %v", err)
	}
	if status.IsDegraded {
		t.Error("expected IsDegraded=false when triggerRepo is nil")
	}
}
