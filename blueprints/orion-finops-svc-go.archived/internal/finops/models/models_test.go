package models

import (
	"testing"
)

func TestCloudCostFields(t *testing.T) {
	c := CloudCost{
		ID:           "test-id",
		TenantID:     "t1",
		ResourceType: "ec2",
		ResourceID:   "i-123",
		Provider:     "aws",
		Region:       "us-east-1",
		Service:      "EC2",
		CostCents:    1500,
		Currency:     "USD",
	}
	if c.ID != "test-id" {
		t.Errorf("expected test-id, got %s", c.ID)
	}
	if c.CostCents != 1500 {
		t.Errorf("expected 1500, got %d", c.CostCents)
	}
}

func TestK8sCostFields(t *testing.T) {
	k := K8sCost{
		ID:           "k8s-id",
		TenantID:     "t1",
		Cluster:      "prod-cluster",
		Namespace:    "default",
		CPUCostCents: 500,
		MemCostCents: 300,
	}
	k.TotalCostCents = k.CPUCostCents + k.MemCostCents
	if k.TotalCostCents != 800 {
		t.Errorf("expected 800, got %d", k.TotalCostCents)
	}
}

func TestSaaSCostFields(t *testing.T) {
	s := SaaSCost{
		ID:         "saas-id",
		TenantID:   "t1",
		Provider:   "github",
		Plan:       "team",
		SeatsUsed:  10,
		SeatsTotal: 20,
		CostCents:  4000,
	}
	if s.SeatsUsed != 10 {
		t.Errorf("expected 10, got %d", s.SeatsUsed)
	}
}

func TestBudgetAlertFields(t *testing.T) {
	a := BudgetAlert{
		ID:           "alert-id",
		TenantID:     "t1",
		Name:         "Monthly Budget",
		BudgetCents:  100000,
		ThresholdPct: 80,
		Status:       AlertActive,
		NotifyEmail:  "ops@example.com",
		Period:       CostPeriodMonthly,
	}
	if a.Status != AlertActive {
		t.Errorf("expected active, got %s", a.Status)
	}
	if a.ThresholdPct != 80 {
		t.Errorf("expected 80, got %d", a.ThresholdPct)
	}
}

func TestCostSummaryAggregation(t *testing.T) {
	s := CostSummary{
		CloudCostCents: 5000,
		K8sCostCents:   3000,
		SaaSCostCents:  2000,
	}
	s.TotalCostCents = s.CloudCostCents + s.K8sCostCents + s.SaaSCostCents
	if s.TotalCostCents != 10000 {
		t.Errorf("expected 10000, got %d", s.TotalCostCents)
	}
}

func TestJSONBValueScan(t *testing.T) {
	j := JSONB{"key": "value"}
	v, err := j.Value()
	if err != nil {
		t.Fatalf("Value() error: %v", err)
	}
	if v == nil {
		t.Fatal("expected non-nil value")
	}

	var j2 JSONB
	err = j2.Scan(v)
	if err != nil {
		t.Fatalf("Scan() error: %v", err)
	}
	if j2["key"] != "value" {
		t.Errorf("expected value, got %v", j2["key"])
	}
}

func TestPaginatedRequestDefaults(t *testing.T) {
	p := PaginatedRequest{}
	if p.Offset() != 0 {
		t.Errorf("expected offset 0, got %d", p.Offset())
	}
	if p.Limit() != 20 {
		t.Errorf("expected limit 20, got %d", p.Limit())
	}
}

func TestPaginatedRequestValues(t *testing.T) {
	p := PaginatedRequest{Page: 3, PageSize: 50}
	if p.Offset() != 100 {
		t.Errorf("expected offset 100, got %d", p.Offset())
	}
	if p.Limit() != 50 {
		t.Errorf("expected limit 50, got %d", p.Limit())
	}
}

func TestPaginatedRequestMax(t *testing.T) {
	p := PaginatedRequest{Page: 1, PageSize: 200}
	if p.Limit() != 100 {
		t.Errorf("expected limit 100 (max), got %d", p.Limit())
	}
}
