package models

import "testing"

func TestLLMModelFields(t *testing.T) {
	d := LLMModel{ID: "d1", TenantID: "t1", Provider: "", ModelName: "", TokenCount: int64(0), CostUSD: float64(0), LatencyMs: 0}
	if d.TenantID != "t1" { t.Errorf("expected t1, got %s", d.TenantID) }
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Limit() != 20 { t.Errorf("expected 20, got %d", p.Limit()) }
}
