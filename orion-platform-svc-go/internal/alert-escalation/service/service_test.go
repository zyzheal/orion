package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/alert-escalation/models"
)

var errNotFound = errors.New("not found")

// --- Fake Repository ---

type fakeAERepo struct {
	policies map[string]*models.EscalationPolicy
	triggers []models.EscalationTrigger
	closures map[string]*models.AlertClosure
	metrics  []models.AlertMetrics
}

func newFakeAERepo() *fakeAERepo {
	return &fakeAERepo{
		policies: make(map[string]*models.EscalationPolicy),
		closures: make(map[string]*models.AlertClosure),
	}
}

func (f *fakeAERepo) CreatePolicy(ctx context.Context, p *models.EscalationPolicy) error {
	f.policies[p.ID] = p
	return nil
}

func (f *fakeAERepo) GetPolicy(ctx context.Context, id, tenantID string) (*models.EscalationPolicy, error) {
	p, ok := f.policies[id]
	if !ok {
		return nil, nil
	}
	return p, nil
}

func (f *fakeAERepo) ListPolicies(ctx context.Context, tenantID string) ([]models.EscalationPolicy, error) {
	var items []models.EscalationPolicy
	for _, p := range f.policies {
		items = append(items, *p)
	}
	return items, nil
}

func (f *fakeAERepo) UpdatePolicy(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.EscalationPolicy, error) {
	p, ok := f.policies[id]
	if !ok {
		return nil, nil
	}
	if v, ok := attrs["name"]; ok {
		p.Name = v.(string)
	}
	return p, nil
}

func (f *fakeAERepo) DeletePolicy(ctx context.Context, id, tenantID string) (bool, error) {
	if _, ok := f.policies[id]; !ok {
		return false, nil
	}
	delete(f.policies, id)
	return true, nil
}

func (f *fakeAERepo) CreateTrigger(ctx context.Context, t *models.EscalationTrigger) error {
	f.triggers = append(f.triggers, *t)
	return nil
}

func (f *fakeAERepo) ListTriggers(ctx context.Context, tenantID, policyID string) ([]models.EscalationTrigger, error) {
	return f.triggers, nil
}

func (f *fakeAERepo) UpdateTrigger(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.EscalationTrigger, error) {
	for i, t := range f.triggers {
		if t.ID == id {
			if v, ok := attrs["status"]; ok {
				f.triggers[i].Status = v.(string)
			}
			return &f.triggers[i], nil
		}
	}
	return nil, nil
}

func (f *fakeAERepo) CreateClosure(ctx context.Context, c *models.AlertClosure) error {
	f.closures[c.AlertID] = c
	return nil
}

func (f *fakeAERepo) GetClosure(ctx context.Context, alertID, tenantID string) (*models.AlertClosure, error) {
	c, ok := f.closures[alertID]
	if !ok {
		return nil, errNotFound
	}
	return c, nil
}

func (f *fakeAERepo) ListClosures(ctx context.Context, tenantID, status string) ([]models.AlertClosure, error) {
	var items []models.AlertClosure
	for _, c := range f.closures {
		if status == "" || c.Status == status {
			items = append(items, *c)
		}
	}
	return items, nil
}

func (f *fakeAERepo) UpdateClosure(ctx context.Context, alertID, tenantID string, attrs map[string]interface{}) (*models.AlertClosure, error) {
	c, ok := f.closures[alertID]
	if !ok {
		return nil, nil
	}
	if v, ok := attrs["status"]; ok {
		c.Status = v.(string)
	}
	if v, ok := attrs["resolved_by"]; ok {
		c.ResolvedBy = v.(string)
	}
	if v, ok := attrs["resolution_note"]; ok {
		c.ResolutionNote = v.(string)
	}
	if v, ok := attrs["mttr_seconds"]; ok {
		c.MTTRSeconds = v.(int64)
	}
	return c, nil
}

func (f *fakeAERepo) CreateMetrics(ctx context.Context, m *models.AlertMetrics) error {
	f.metrics = append(f.metrics, *m)
	return nil
}

func (f *fakeAERepo) ListMetrics(ctx context.Context, tenantID string, from, to time.Time) ([]models.AlertMetrics, error) {
	return f.metrics, nil
}

// --- Tests ---

func TestAE_CreatePolicy_success(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)

	req := &models.CreatePolicyRequest{
		Name:     "severe-policy",
		Severity: "critical",
		Rules: []models.EscalationRule{
			{Level: 1, DelayMinutes: 5, Target: "oncall", Channel: "slack", Message: "page"},
		},
	}
	p, err := svc.CreatePolicy(context.Background(), req, "t1", "admin")
	if err != nil {
		t.Fatalf("CreatePolicy error: %v", err)
	}
	if p.Name != "severe-policy" {
		t.Errorf("Name = %q", p.Name)
	}
	if p.Severity != "critical" {
		t.Errorf("Severity = %q, want critical", p.Severity)
	}
	if p.Status != "active" {
		t.Errorf("Status = %q, want active", p.Status)
	}
}

func TestAE_CreatePolicy_defaultsSeverity(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)

	req := &models.CreatePolicyRequest{
		Name: "default-sev",
		Rules: []models.EscalationRule{
			{Level: 1, DelayMinutes: 0},
		},
	}
	p, err := svc.CreatePolicy(context.Background(), req, "t1", "admin")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if p.Severity != "all" {
		t.Errorf("Severity = %q, want 'all' (default)", p.Severity)
	}
}

func TestAE_EvaluatePolicy_matchesSeverity(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)

	svc.CreatePolicy(context.Background(), &models.CreatePolicyRequest{
		Name:     "crit-only",
		Severity: "critical",
		Rules: []models.EscalationRule{
			{Level: 1, DelayMinutes: 0, Target: "t1", Channel: "c1", Message: "m1"},
		},
	}, "t1", "admin")

	triggers, err := svc.EvaluatePolicy(context.Background(), "alert-1", "warning", "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if len(triggers) != 0 {
		t.Errorf("EvaluatePolicy(warning) = %d, want 0 (policy is critical-only)", len(triggers))
	}

	triggers, err = svc.EvaluatePolicy(context.Background(), "alert-1", "critical", "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if len(triggers) != 1 {
		t.Errorf("EvaluatePolicy(critical) = %d, want 1", len(triggers))
	}
}

func TestAE_EvaluatePolicy_skipsInactive(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)

	p, _ := svc.CreatePolicy(context.Background(), &models.CreatePolicyRequest{
		Name:  "inactive",
		Rules: []models.EscalationRule{{Level: 1}},
	}, "t1", "admin")
	// Manually set inactive
	repo.policies[p.ID].Status = "disabled"

	triggers, _ := svc.EvaluatePolicy(context.Background(), "a", "all", "t1")
	if len(triggers) != 0 {
		t.Error("EvaluatePolicy should skip inactive policies")
	}
}

func TestAE_CreateAlertClosure(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)

	c, err := svc.CreateAlertClosure(context.Background(), "alert-1", "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if c.Status != "open" {
		t.Errorf("Status = %q, want open", c.Status)
	}
}

func TestAE_AcknowledgeAlert_createsWhenMissing(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)

	c, err := svc.AcknowledgeAlert(context.Background(), "alert-1", "t1", "oncall-user")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if c.Status != "acknowledged" {
		t.Errorf("Status = %q, want acknowledged", c.Status)
	}
	if c.AcknowledgedBy != "oncall-user" {
		t.Errorf("AcknowledgedBy = %q", c.AcknowledgedBy)
	}
}

func TestAE_AcknowledgeAlert_updatesExisting(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)

	// Create closure first
	svc.CreateAlertClosure(context.Background(), "alert-1", "t1")

	c, err := svc.AcknowledgeAlert(context.Background(), "alert-1", "t1", "oncall")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if c.Status != "acknowledged" {
		t.Errorf("Status = %q, want acknowledged", c.Status)
	}
}

func TestAE_ResolveAlert_computesMTTR(t *testing.T) {
	repo := newFakeAERepo()
	svc := NewService(repo)

	c, err := svc.ResolveAlert(context.Background(), &models.ResolveRequest{
		AlertID:        "alert-1",
		Operator:       "fixer",
		ResolutionNote: "restarted service",
	}, "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if c.Status != "resolved" {
		t.Errorf("Status = %q, want resolved", c.Status)
	}
	if c.ResolvedBy != "fixer" {
		t.Errorf("ResolvedBy = %q", c.ResolvedBy)
	}
	if c.ResolutionNote != "restarted service" {
		t.Errorf("ResolutionNote = %q", c.ResolutionNote)
	}
	if c.MTTRSeconds < 0 {
		t.Errorf("MTTRSeconds = %d, want >= 0", c.MTTRSeconds)
	}
}
