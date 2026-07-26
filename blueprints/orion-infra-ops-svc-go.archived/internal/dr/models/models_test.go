package models

import "testing"

func TestDRPlanFields(t *testing.T) {
	d := DRPlan{ID: "d1", TenantID: "t1", PlanType: "", RPO: 0, RTO: 0, Status: "", LastTested: nil, Config: nil}
	if d.TenantID != "t1" { t.Errorf("expected t1, got %s", d.TenantID) }
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Limit() != 20 { t.Errorf("expected 20, got %d", p.Limit()) }
}
