package models

import "testing"

func TestPaginatedRequest_Offset(t *testing.T) {
	tests := []struct {
		name     string
		page     int
		pageSize int
		want     int
	}{
		{"zero values default to page 1 size 20", 0, 0, 0},
		{"page 1 offset 0", 1, 10, 0},
		{"page 2 size 10 offset 10", 2, 10, 10},
		{"page 3 size 5 offset 10", 3, 5, 10},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := PaginatedRequest{Page: tt.page, PageSize: tt.pageSize}
			if got := p.Offset(); got != tt.want {
				t.Errorf("Offset() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestPaginatedRequest_Limit(t *testing.T) {
	tests := []struct {
		name     string
		pageSize int
		want     int
	}{
		{"zero defaults to 20", 0, 20},
		{"negative defaults to 20", -5, 20},
		{"valid size 50", 50, 50},
		{"over 100 capped", 200, 100},
		{"exactly 100", 100, 100},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := PaginatedRequest{PageSize: tt.pageSize}
			if got := p.Limit(); got != tt.want {
				t.Errorf("Limit() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestCostCategory_Constants(t *testing.T) {
	cats := []CostCategory{
		CategoryCompute,
		CategoryStorage,
		CategoryNetwork,
		CategoryDatabase,
		CategoryAI,
		CategorySaaS,
		CategoryOther,
	}
	expected := []string{"compute", "storage", "network", "database", "ai", "saas", "other"}
	for i, c := range cats {
		if string(c) != expected[i] {
			t.Errorf("category %d = %s, want %s", i, c, expected[i])
		}
	}
}

func TestAnomalyType_Constants(t *testing.T) {
	types := []AnomalyType{AnomalySpike, AnomalyDrop, AnomalyTrendChange, AnomalySustainedHigh}
	expected := []string{"spike", "drop", "trend_change", "sustained_high"}
	for i, a := range types {
		if string(a) != expected[i] {
			t.Errorf("anomaly %d = %s, want %s", i, a, expected[i])
		}
	}
}

func TestBudgetPeriod_Constants(t *testing.T) {
	periods := []BudgetPeriod{BudgetPeriodDaily, BudgetPeriodWeekly, BudgetPeriodMonthly, BudgetPeriodYearly}
	expected := []string{"daily", "weekly", "monthly", "yearly"}
	for i, p := range periods {
		if string(p) != expected[i] {
			t.Errorf("period %d = %s, want %s", i, p, expected[i])
		}
	}
}
