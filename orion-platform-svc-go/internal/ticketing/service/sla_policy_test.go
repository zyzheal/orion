package service

import (
	"context"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/ticketing/models"
)

// slaPolicyRepo records the identifier every SLA-policy and automation-rule
// method was called with. The embedded RepositoryInterface is deliberately left
// nil so a call onto anything else panics instead of returning nil.
type slaPolicyRepo struct {
	RepositoryInterface

	getID         string
	policy        *models.SLAPolicy
	getErr        error
	updateID      string
	updates       map[string]interface{}
	updateErr     error
	deleteID      string
	deleteErr     error
	complianceID  string
	compliance    *models.ComplianceResult
	complianceErr error
	ruleUpdateID  string
	ruleUpdates   map[string]interface{}
	ruleUpdateErr error
	ruleDeleteID  string
	ruleDeleteErr error
	rules         []models.AutomationRule
	rulesErr      error
	ruleRemoveID  string
	ruleRemoveErr error
}

func (r *slaPolicyRepo) GetSLAPolicy(ctx context.Context, tenantID, policyID string) (*models.SLAPolicy, error) {
	r.getID = policyID
	return r.policy, r.getErr
}

func (r *slaPolicyRepo) UpdateSLAPolicy(ctx context.Context, tenantID string, policyID string, updates map[string]interface{}) error {
	r.updateID = policyID
	r.updates = updates
	return r.updateErr
}

func (r *slaPolicyRepo) DeleteSLAPolicy(ctx context.Context, tenantID, policyID string) error {
	r.deleteID = policyID
	return r.deleteErr
}

func (r *slaPolicyRepo) GetSLACompliance(ctx context.Context, tenantID, policyID string) (*models.ComplianceResult, error) {
	r.complianceID = policyID
	return r.compliance, r.complianceErr
}

func (r *slaPolicyRepo) UpdateAutomationRule(ctx context.Context, tenantID string, ruleID string, updates map[string]interface{}) error {
	r.ruleUpdateID = ruleID
	r.ruleUpdates = updates
	return r.ruleUpdateErr
}

func (r *slaPolicyRepo) DeleteAutomationRule(ctx context.Context, tenantID, ruleID string) error {
	r.ruleDeleteID = ruleID
	return r.ruleDeleteErr
}

func (r *slaPolicyRepo) ListAutomationRules(ctx context.Context, tenantID string) ([]models.AutomationRule, error) {
	return r.rules, r.rulesErr
}

func (r *slaPolicyRepo) DeleteAssignmentRule(ctx context.Context, tenantID, id string) error {
	r.ruleRemoveID = id
	return r.ruleRemoveErr
}

const uuidPolicy = "550e8400-e29b-41d4-a716-446655440000"

// Round 64: 655_create_ticketing_missing_tables.sql declares these ids as UUID
// PRIMARY KEY, so the route parameter is already the identifier. Every method
// below used to strconv.Atoi it first and return "invalid policy id" before the
// query ran, which made every SLA policy read, update, delete and compliance
// call a hard 400 for the ids the database actually holds. The four tests here
// each fail the instant the coercion is reintroduced, because strconv.Atoi
// rejects uuidPolicy and the double is never reached.

func TestGetSLAPolicyReachesTheRepositoryWithAUUIDID(t *testing.T) {
	repo := &slaPolicyRepo{policy: &models.SLAPolicy{ID: uuidPolicy, Name: "gold"}}
	svc := NewService(repo)

	p, err := svc.GetSLAPolicy(context.Background(), "t1", uuidPolicy)
	if err != nil {
		t.Fatalf("GetSLAPolicy(uuid) returned an error: %v", err)
	}
	if repo.getID != uuidPolicy {
		t.Fatalf("repository was called with %q, want %q", repo.getID, uuidPolicy)
	}
	if p.ID != uuidPolicy {
		t.Errorf("GetSLAPolicy returned %q, want %q", p.ID, uuidPolicy)
	}
}

func TestDeleteSLAPolicyReachesTheRepositoryWithAUUIDID(t *testing.T) {
	repo := &slaPolicyRepo{}
	svc := NewService(repo)

	if err := svc.DeleteSLAPolicy(context.Background(), "t1", uuidPolicy); err != nil {
		t.Fatalf("DeleteSLAPolicy(uuid) returned an error: %v", err)
	}
	if repo.deleteID != uuidPolicy {
		t.Fatalf("repository was called with %q, want %q", repo.deleteID, uuidPolicy)
	}
}

func TestGetComplianceReachesTheRepositoryWithAUUIDID(t *testing.T) {
	repo := &slaPolicyRepo{compliance: &models.ComplianceResult{PolicyID: uuidPolicy, Total: 10, Compliant: 8}}
	svc := NewService(repo)

	cr, err := svc.GetCompliance(context.Background(), "t1", uuidPolicy)
	if err != nil {
		t.Fatalf("GetCompliance(uuid) returned an error: %v", err)
	}
	if repo.complianceID != uuidPolicy {
		t.Fatalf("repository was called with %q, want %q", repo.complianceID, uuidPolicy)
	}
	if cr.Total != 10 || cr.Compliant != 8 {
		t.Errorf("compliance did not pass through: %+v", cr)
	}
}

func TestRemoveAssignmentRuleReachesTheRepositoryWithAUUIDID(t *testing.T) {
	repo := &slaPolicyRepo{}
	svc := NewService(repo)

	if err := svc.RemoveAssignmentRule(context.Background(), "t1", uuidPolicy); err != nil {
		t.Fatalf("RemoveAssignmentRule(uuid) returned an error: %v", err)
	}
	if repo.ruleRemoveID != uuidPolicy {
		t.Fatalf("repository was called with %q, want %q", repo.ruleRemoveID, uuidPolicy)
	}
}

// TestUpdateSLAPolicyPassesTheUUIDAndEveryFieldThrough pins both halves of the
// fix: the id reaches the repository uncoerced, and every supplied field is in
// the map. UpdateSLAPolicy used to write only updated_at no matter what the
// request carried, so name, priority, response_hours, resolve_hours and active
// were silently discarded while the handler reported success.
func TestUpdateSLAPolicyPassesTheUUIDAndEveryFieldThrough(t *testing.T) {
	name := "gold-v2"
	priority := "critical"
	responseH := 0
	resolveH := 2
	active := false
	repo := &slaPolicyRepo{
		updateID: "",
		policy:   &models.SLAPolicy{ID: uuidPolicy},
	}
	svc := NewService(repo)

	p, err := svc.UpdateSLAPolicy(context.Background(), "t1", uuidPolicy, models.UpdateSLAPolicyRequest{
		Name: &name, Priority: &priority, ResponseH: &responseH, ResolveH: &resolveH, Active: &active,
	})
	if err != nil {
		t.Fatalf("UpdateSLAPolicy(uuid) returned an error: %v", err)
	}
	if repo.updateID != uuidPolicy {
		t.Fatalf("repository was called with %q, want %q", repo.updateID, uuidPolicy)
	}
	want := map[string]interface{}{
		"name": "gold-v2", "priority": "critical",
		"response_hours": 0, "resolve_hours": 2, "active": false,
	}
	for k, v := range want {
		got, ok := repo.updates[k]
		if !ok {
			t.Errorf("UpdateSLAPolicy dropped %q", k)
			continue
		}
		if got != v {
			t.Errorf("UpdateSLAPolicy[%q] = %v, want %v", k, got, v)
		}
	}
	if len(repo.updates) != len(want) {
		t.Errorf("UpdateSLAPolicy sent %d keys, want %d: %v", len(repo.updates), len(want), repo.updates)
	}
	if p.ID != uuidPolicy {
		t.Errorf("UpdateSLAPolicy returned %q, want %q", p.ID, uuidPolicy)
	}
}

func TestDeleteAutomationRuleReachesTheRepositoryWithAUUIDID(t *testing.T) {
	repo := &slaPolicyRepo{}
	svc := NewService(repo)

	if err := svc.DeleteAutomationRule(context.Background(), "t1", uuidPolicy); err != nil {
		t.Fatalf("DeleteAutomationRule(uuid) returned an error: %v", err)
	}
	if repo.ruleDeleteID != uuidPolicy {
		t.Fatalf("repository was called with %q, want %q", repo.ruleDeleteID, uuidPolicy)
	}
}

func TestUpdateAutomationRulePassesTheUUIDAndEveryFieldThrough(t *testing.T) {
	rule := &models.AutomationRule{ID: uuidPolicy, Name: "escalate"}
	repo := &slaPolicyRepo{rules: []models.AutomationRule{*rule}}
	svc := NewService(repo)

	out, err := svc.UpdateAutomationRule(context.Background(), "t1", uuidPolicy, models.UpdateAutomationRuleRequest{
		Name:      stringPtr("escalate-v2"),
		Trigger:   stringPtr("on_escalate"),
		Condition: stringPtr(`priority == "critical"`),
		Action:    stringPtr("notify"),
		Enabled:   boolPtr(true),
	})
	if err != nil {
		t.Fatalf("UpdateAutomationRule(uuid) returned an error: %v", err)
	}
	if repo.ruleUpdateID != uuidPolicy {
		t.Fatalf("repository was called with %q, want %q", repo.ruleUpdateID, uuidPolicy)
	}
	want := map[string]interface{}{
		"name": "escalate-v2", "trigger": "on_escalate",
		"condition": `priority == "critical"`, "action": "notify", "enabled": true,
	}
	for k, v := range want {
		got, ok := repo.ruleUpdates[k]
		if !ok {
			t.Errorf("UpdateAutomationRule dropped %q", k)
			continue
		}
		if got != v {
			t.Errorf("UpdateAutomationRule[%q] = %v, want %v", k, got, v)
		}
	}
	if out.ID != uuidPolicy || out.Name != "escalate" {
		t.Errorf("UpdateAutomationRule returned %+v, want ID %q", out, uuidPolicy)
	}
}

// TestUpdateAutomationRuleMapsAMissingRuleToNotFound pins the List-then-filter
// that replaced the deleted GetAutomationRule: a rule the tenant does not own
// must not come back as a nil map entry.
func TestUpdateAutomationRuleMapsAMissingRuleToNotFound(t *testing.T) {
	repo := &slaPolicyRepo{rules: []models.AutomationRule{{ID: "someone-elses-rule", Name: "other"}}}
	svc := NewService(repo)

	_, err := svc.UpdateAutomationRule(context.Background(), "t1", uuidPolicy,
		models.UpdateAutomationRuleRequest{Name: stringPtr("escalate-v2")})
	if err == nil {
		t.Fatal("UpdateAutomationRule succeeded for a rule the tenant does not own")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Fatalf("UpdateAutomationRule error %q does not report not found", err.Error())
	}
	if repo.ruleUpdateID != uuidPolicy {
		t.Errorf("repository was called with %q, want %q", repo.ruleUpdateID, uuidPolicy)
	}
}

func stringPtr(s string) *string { return &s }

func boolPtr(b bool) *bool { return &b }
