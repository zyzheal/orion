package models

import "testing"

func TestRunnerFields(t *testing.T) {
	d := Runner{ID: "d1", TenantID: "t1", Type: "", Status: "", Endpoint: "", Capacity: 0, Labels: nil}
	if d.TenantID != "t1" { t.Errorf("expected t1, got %s", d.TenantID) }
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Limit() != 20 { t.Errorf("expected 20, got %d", p.Limit()) }
}
