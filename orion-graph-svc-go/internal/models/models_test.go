package models

import "testing"

func TestGraphNodeFields(t *testing.T) {
	d := GraphNode{ID: "d1", TenantID: "t1", NodeType: "", Properties: nil}
	if d.TenantID != "t1" { t.Errorf("expected t1, got %s", d.TenantID) }
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Limit() != 20 { t.Errorf("expected 20, got %d", p.Limit()) }
}
