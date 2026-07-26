package models

import "testing"

func TestLLMTraceFields(t *testing.T) {
	status := "pending"
	trace := LLMTrace{TraceID: "tr1", TenantID: "t1", ModelID: "gpt-4", Status: status}
	if trace.TenantID != "t1" {
		t.Errorf("expected t1, got %s", trace.TenantID)
	}
	if trace.Status != "pending" {
		t.Errorf("expected pending, got %s", trace.Status)
	}
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Limit() != 20 {
		t.Errorf("expected 20, got %d", p.Limit())
	}
}

func TestDefaultModelPricing(t *testing.T) {
	p, ok := DefaultModelPricing["gpt-4"]
	if !ok {
		t.Fatal("expected gpt-4 in DefaultModelPricing")
	}
	if p.Input != 0.002 {
		t.Errorf("expected input 0.002, got %f", p.Input)
	}
	if p.Output != 0.004 {
		t.Errorf("expected output 0.004, got %f", p.Output)
	}
}

func TestJSONBScanNil(t *testing.T) {
	var j JSONB
	if err := j.Scan(nil); err != nil {
		t.Fatalf("unexpected error scanning nil: %v", err)
	}
	if j != nil {
		t.Errorf("expected nil, got %v", j)
	}
}
