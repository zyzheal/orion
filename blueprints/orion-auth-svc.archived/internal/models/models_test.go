package models

import "testing"

func TestPaginatedRequest_Defaults(t *testing.T) {
	p := &PaginatedRequest{}
	if p.Offset() != 0 {
		t.Errorf("expected offset 0, got %d", p.Offset())
	}
	if p.Limit() != 20 {
		t.Errorf("expected limit 20, got %d", p.Limit())
	}
}

func TestPaginatedRequest_CustomValues(t *testing.T) {
	p := &PaginatedRequest{Page: 3, PageSize: 50}
	if p.Offset() != 100 {
		t.Errorf("expected offset 100, got %d", p.Offset())
	}
	if p.Limit() != 50 {
		t.Errorf("expected limit 50, got %d", p.Limit())
	}
}

func TestPaginatedRequest_MaxPageSize(t *testing.T) {
	p := &PaginatedRequest{Page: 1, PageSize: 500}
	if p.Limit() != 100 {
		t.Errorf("expected limit capped at 100, got %d", p.Limit())
	}
}

func TestPaginatedRequest_ZeroPage(t *testing.T) {
	p := &PaginatedRequest{Page: 0, PageSize: 10}
	if p.Offset() != 0 {
		t.Errorf("expected offset 0 for page 0, got %d", p.Offset())
	}
}
