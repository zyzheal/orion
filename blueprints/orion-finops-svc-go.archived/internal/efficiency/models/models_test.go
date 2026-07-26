package models

import "testing"

func TestEfficiencyMetricFields(t *testing.T) {
	d := EfficiencyMetric{ID: "d1", TenantID: "t1", MetricType: "", Value: float64(0), Target: float64(0), Unit: "", Period: ""}
	if d.TenantID != "t1" { t.Errorf("expected t1, got %s", d.TenantID) }
}

func TestPaginatedDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Limit() != 20 { t.Errorf("expected 20, got %d", p.Limit()) }
}
