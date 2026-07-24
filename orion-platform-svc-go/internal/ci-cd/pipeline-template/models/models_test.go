package models

import "testing"

func TestPipelineTemplateFields(t *testing.T) {
	d := PipelineTemplate{ID: "d1", TenantID: "t1", Description: "", YAMLContent: "", Version: 0, Tags: nil}
	if d.TenantID != "t1" { t.Errorf("expected t1, got %s", d.TenantID) }
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Limit() != 20 { t.Errorf("expected 20, got %d", p.Limit()) }
}
