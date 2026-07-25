package service

import (
	"context"
	"time"

	"orion/ai-svc-go/internal/aicost/models"
	"orion/ai-svc-go/internal/aicost/repository"

	"github.com/google/uuid"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// AnalyzeCostSavings returns a cost analysis with opportunities for a tenant.
func (s *Service) AnalyzeCostSavings(tenantID string) models.CostOptimizationAnalysis {
	// Simulate cost analysis — in production this would query actual cost data
	opportunities := []models.CostSavingsOpportunity{
		{
			Category:                "model_optimization",
			ResourceName:            "gpt-4 -> gpt-4-turbo migration",
			EstimatedMonthlySavings: 1200.00,
			RiskLevel:               "low",
			Description:             "Switch from gpt-4 to gpt-4-turbo for non-critical tasks",
		},
		{
			Category:                "idle_resources",
			ResourceName:            "unused model deployments",
			EstimatedMonthlySavings: 800.00,
			RiskLevel:               "medium",
			Description:             "Remove unused model deployments to reduce hosting costs",
		},
	}

	return models.CostOptimizationAnalysis{
		TenantID:      tenantID,
		TotalSpend:    5000.00,
		Opportunities: opportunities,
		Currency:      "CNY",
	}
}

// RecommendOptimization returns cost optimization recommendations.
func (s *Service) RecommendOptimization(tenantID string) ([]models.CostSavingsOpportunity, error) {
	return s.AnalyzeCostSavings(tenantID).Opportunities, nil
}

// GetSavingsHistory returns savings tracking history.
func (s *Service) GetSavingsHistory(ctx context.Context, tenantID string) ([]models.SavingsRecord, error) {
	return s.repo.ListSavingsHistory(ctx, tenantID)
}

// GetTotalSavings returns total savings to date.
func (s *Service) GetTotalSavings(ctx context.Context, tenantID string) (float64, error) {
	return s.repo.GetTotalSavings(ctx, tenantID)
}

// RecordSavings records a new savings entry.
func (s *Service) RecordSavings(ctx context.Context, tenantID string, amount float64, category, description string) (*models.SavingsRecord, error) {
	record := &models.SavingsRecord{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		Amount:      amount,
		Category:    category,
		Description: description,
		CreatedAt:   time.Now(),
	}
	if err := s.repo.CreateSavingsRecord(ctx, record); err != nil {
		return nil, err
	}
	return record, nil
}

// GenerateAlerts generates cost alerts from high-priority opportunities.
func (s *Service) GenerateAlerts(tenantID string) []models.CostAlert {
	analysis := s.AnalyzeCostSavings(tenantID)
	var alerts []models.CostAlert
	for _, opp := range analysis.Opportunities {
		if opp.EstimatedMonthlySavings > 500 {
			alerts = append(alerts, models.CostAlert{
				Type:                   "high_savings_opportunity",
				Category:               opp.Category,
				ResourceName:           opp.ResourceName,
				EstimatedMonthlySavings: opp.EstimatedMonthlySavings,
				RiskLevel:              opp.RiskLevel,
				Description:            opp.Description,
			})
		}
	}
	return alerts
}