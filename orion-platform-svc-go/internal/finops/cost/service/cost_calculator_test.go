package service

import (
	"context"
	"testing"
	"time"

	"orion/platform-svc-go/internal/finops/cost/models"

	"go.uber.org/zap"
)

func testLogger() *zap.Logger {
	return zap.NewNop()
}

func sampleRecords() []models.CostRecord {
	r1 := ptr("r1")
	r2 := ptr("r2")
	return []models.CostRecord{
		{ID: "1", TenantID: "t1", Date: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC), Service: "svc-a", ResourceID: r1, Cost: 10.0, Category: string(models.CategoryCompute)},
		{ID: "2", TenantID: "t1", Date: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC), Service: "svc-a", ResourceID: r1, Cost: 20.0, Category: string(models.CategoryStorage)},
		{ID: "3", TenantID: "t1", Date: time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC), Service: "svc-b", ResourceID: r2, Cost: 30.0, Category: string(models.CategoryCompute)},
		{ID: "4", TenantID: "t1", Date: time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC), Service: "svc-a", ResourceID: nil, Cost: 5.0, Category: string(models.CategoryNetwork)},
	}
}

func ptr(s string) *string {
	return &s
}

func TestCostCalculator_CalculatePerResource(t *testing.T) {
	calc := NewCostCalculator(testLogger())
	ctx := context.Background()
	costs := sampleRecords()

	result := calc.CalculatePerResource(ctx, costs)

	if result["r1"] != 30.0 {
		t.Errorf("expected r1=30, got %f", result["r1"])
	}
	if result["r2"] != 30.0 {
		t.Errorf("expected r2=30, got %f", result["r2"])
	}
	if result["unknown"] != 5.0 {
		t.Errorf("expected unknown=5, got %f", result["unknown"])
	}
}

func TestCostCalculator_CalculatePerResource_Empty(t *testing.T) {
	calc := NewCostCalculator(testLogger())
	ctx := context.Background()
	result := calc.CalculatePerResource(ctx, []models.CostRecord{})

	if len(result) != 0 {
		t.Errorf("expected empty result, got %v", result)
	}
}

func TestCostCalculator_CalculatePerTimePeriod(t *testing.T) {
	calc := NewCostCalculator(testLogger())
	ctx := context.Background()
	costs := sampleRecords()

	result := calc.CalculatePerTimePeriod(ctx, costs)

	if result["2026-01-01"] != 30.0 {
		t.Errorf("expected 2026-01-01=30, got %f", result["2026-01-01"])
	}
	if result["2026-01-02"] != 35.0 {
		t.Errorf("expected 2026-01-02=35, got %f", result["2026-01-02"])
	}
}

func TestCostCalculator_CalculateByService(t *testing.T) {
	calc := NewCostCalculator(testLogger())
	ctx := context.Background()
	costs := sampleRecords()

	result := calc.CalculateByService(ctx, costs)

	if result["svc-a"] != 35.0 {
		t.Errorf("expected svc-a=35, got %f", result["svc-a"])
	}
	if result["svc-b"] != 30.0 {
		t.Errorf("expected svc-b=30, got %f", result["svc-b"])
	}
}

func TestCostCalculator_CalculateByCategory(t *testing.T) {
	calc := NewCostCalculator(testLogger())
	ctx := context.Background()
	costs := sampleRecords()

	result := calc.CalculateByCategory(ctx, costs)

	if result[string(models.CategoryCompute)] != 40.0 {
		t.Errorf("expected compute=40, got %f", result[string(models.CategoryCompute)])
	}
	if result[string(models.CategoryStorage)] != 20.0 {
		t.Errorf("expected storage=20, got %f", result[string(models.CategoryStorage)])
	}
	if result[string(models.CategoryNetwork)] != 5.0 {
		t.Errorf("expected network=5, got %f", result[string(models.CategoryNetwork)])
	}
}

func TestCostCalculator_Total(t *testing.T) {
	calc := NewCostCalculator(testLogger())
	ctx := context.Background()
	costs := sampleRecords()

	total := calc.Total(ctx, costs)
	if total != 65.0 {
		t.Errorf("expected 65, got %f", total)
	}

	totalEmpty := calc.Total(ctx, []models.CostRecord{})
	if totalEmpty != 0.0 {
		t.Errorf("expected 0, got %f", totalEmpty)
	}
}
