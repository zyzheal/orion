package models

import "testing"

// TestSpaceFields verifies that Space model fields are accessible.
func TestSpaceFields(t *testing.T) {
	s := Space{ID: "d1", TenantID: "t1"}
	if s.TenantID != "t1" {
		t.Errorf("expected t1, got %s", s.TenantID)
	}
}

// TestPaginatedDefaults verifies pagination defaults.
func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Limit() != 20 {
		t.Errorf("expected 20, got %d", p.Limit())
	}
}
