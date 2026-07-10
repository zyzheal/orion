package service

import (
	"context"

	"orion/cost-svc-go/internal/models"

	"go.uber.org/zap"
)

// CostCalculator provides cost calculation logic per resource and time period.
type CostCalculator struct {
	logger *zap.Logger
}

// NewCostCalculator creates a new calculator instance.
func NewCostCalculator(logger *zap.Logger) *CostCalculator {
	return &CostCalculator{logger: logger}
}

// CalculatePerResource returns the cost for a specific resource.
func (c *CostCalculator) CalculatePerResource(ctx context.Context, costs []models.CostRecord) map[string]float64 {
	result := make(map[string]float64)
	for _, cost := range costs {
		key := "unknown"
		if cost.ResourceID != nil {
			key = *cost.ResourceID
		}
		result[key] += cost.Cost
	}
	return result
}

// CalculatePerTimePeriod returns the cost for a specific time period.
func (c *CostCalculator) CalculatePerTimePeriod(ctx context.Context, costs []models.CostRecord) map[string]float64 {
	result := make(map[string]float64)
	for _, cost := range costs {
		date := cost.Date.Format("2006-01-02")
		result[date] += cost.Cost
	}
	return result
}

// CalculateByService returns the cost grouped by service.
func (c *CostCalculator) CalculateByService(ctx context.Context, costs []models.CostRecord) map[string]float64 {
	result := make(map[string]float64)
	for _, cost := range costs {
		result[cost.Service] += cost.Cost
	}
	return result
}

// CalculateByCategory returns the cost grouped by category.
func (c *CostCalculator) CalculateByCategory(ctx context.Context, costs []models.CostRecord) map[string]float64 {
	result := make(map[string]float64)
	for _, cost := range costs {
		result[cost.Category] += cost.Cost
	}
	return result
}

// Total returns the sum of all costs.
func (c *CostCalculator) Total(ctx context.Context, costs []models.CostRecord) float64 {
	total := 0.0
	for _, cost := range costs {
		total += cost.Cost
	}
	return roundFloat(total)
}
