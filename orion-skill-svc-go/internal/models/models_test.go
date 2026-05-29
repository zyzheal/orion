package models

import "testing"

func TestSkillFields(t *testing.T) {
	d := Skill{ID: "d1", TenantID: "t1", Description: "", Category: "", InputSchema: nil, OutputSchema: nil, Version: 0}
	if d.TenantID != "t1" { t.Errorf("expected t1, got %s", d.TenantID) }
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Limit() != 20 { t.Errorf("expected 20, got %d", p.Limit()) }
}
