package models

import "testing"

func TestInspectionRuleFields(t *testing.T) {
	d := InspectionRule{ID: "r1", TenantID: "t1", Name: "test", RuleType: "health", Target: "k8s", Condition: nil, Severity: "high", Enabled: true}
	if d.TenantID != "t1" { t.Errorf("expected t1, got %s", d.TenantID) }
	if d.RuleType != "health" { t.Errorf("expected health, got %s", d.RuleType) }
	if d.Severity != "high" { t.Errorf("expected high, got %s", d.Severity) }
	if !d.Enabled { t.Errorf("expected true") }
}

func TestInspectionResultFields(t *testing.T) {
	d := InspectionResult{ID: "res1", TenantID: "t1", RuleID: "r1", RuleName: "test", Status: "pass", Target: "k8s"}
	if d.Status != "pass" { t.Errorf("expected pass, got %s", d.Status) }
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Limit() != 20 { t.Errorf("expected 20, got %d", p.Limit()) }
}
