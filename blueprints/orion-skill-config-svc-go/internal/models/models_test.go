package models

import "testing"

func TestSkillConfigFields(t *testing.T) {
	d := SkillConfig{ID: "d1", TenantID: "t1", SkillID: "", ConfigKey: "", ConfigValue: "", Environment: ""}
	if d.TenantID != "t1" { t.Errorf("expected t1, got %s", d.TenantID) }
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Limit() != 20 { t.Errorf("expected 20, got %d", p.Limit()) }
}
