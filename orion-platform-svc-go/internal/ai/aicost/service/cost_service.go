package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ai/aicost/models"
	"orion/platform-svc-go/internal/ai/aicost/repository"

	"github.com/google/uuid"
)

type Service struct {
	repo repository.RepositoryInterface
}

func NewService(repo repository.RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// defaultCurrency is the display currency of a cost analysis. No cost table
// carries a currency column, so this is a presentation default, not a value
// read from storage.
const defaultCurrency = "CNY"

// highSpendShare and midSpendShare rank a model by the share of the tenant's
// monthly spend it carries. They are policy thresholds for how risky acting on
// a model is, not measurements.
const (
	highSpendShare = 0.5
	midSpendShare  = 0.25
)

// alertSavingsFloor is the monthly spend below which an opportunity is not
// worth surfacing as an alert.
const alertSavingsFloor = 500.0

// AnalyzeCostSavings returns the tenant's cost picture: all-time recorded
// spend plus the consolidation opportunities its recent records support.
//
// It used to return a hardcoded 5000.00 spend and two hardcoded opportunities
// about a gpt-4 migration while ignoring tenantID, so every tenant read the
// same analysis. Both numbers now come from ai_cost_records.
func (s *Service) AnalyzeCostSavings(ctx context.Context, tenantID string) (models.CostOptimizationAnalysis, error) {
	totalSpend, err := s.repo.GetTotalSpend(ctx, tenantID)
	if err != nil {
		return models.CostOptimizationAnalysis{}, fmt.Errorf("read total spend: %w", err)
	}
	opportunities, err := s.buildOpportunities(ctx, tenantID)
	if err != nil {
		return models.CostOptimizationAnalysis{}, err
	}
	return models.CostOptimizationAnalysis{
		TenantID:      tenantID,
		TotalSpend:    totalSpend,
		Opportunities: opportunities,
		Currency:      defaultCurrency,
	}, nil
}

// RecommendOptimization returns the tenant's consolidation opportunities, the
// same set a full analysis carries.
func (s *Service) RecommendOptimization(ctx context.Context, tenantID string) ([]models.CostSavingsOpportunity, error) {
	return s.buildOpportunities(ctx, tenantID)
}

// buildOpportunities turns the tenant's per-model spend into opportunities: one
// per model that recorded spend in the last 30 days.
//
// The estimated savings is that model's own observed spend. The money the
// tenant already pays for a model is the budget a migration or consolidation
// can address, so it is the addressable amount and an upper bound, not a
// promise; the description says so. The share is computed against the models'
// 30-day spend, never against the all-time total, because mixing the two
// windows would make the percentage meaningless.
//
// Nothing is invented: a tenant with no records gets no opportunities. It used
// to return two hardcoded opportunities worth 1200.00 and 800.00 for every
// tenant.
func (s *Service) buildOpportunities(ctx context.Context, tenantID string) ([]models.CostSavingsOpportunity, error) {
	opportunities := make([]models.CostSavingsOpportunity, 0)
	byModel, err := s.repo.ListSpendByModel(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("read spend by model: %w", err)
	}

	windowTotal := 0.0
	for _, m := range byModel {
		if m.Spend > 0 {
			windowTotal += m.Spend
		}
	}

	for _, m := range byModel {
		if m.Spend <= 0 {
			continue
		}
		share := 0.0
		if windowTotal > 0 {
			share = m.Spend / windowTotal
		}
		name := modelName(m.ModelID)
		opportunities = append(opportunities, models.CostSavingsOpportunity{
			Category:                "model_consolidation",
			ResourceName:            name,
			EstimatedMonthlySavings: m.Spend,
			RiskLevel:               riskForShare(share),
			Description: fmt.Sprintf(
				"%s recorded %.2f across %d request(s) in the last 30 days (%.0f%% of the tenant's monthly spend); migrating or consolidating it is worth at most that amount",
				name, m.Spend, m.Requests, share*100),
		})
	}
	return opportunities, nil
}

// modelName names a model that recorded spend. model_id is nullable, so an
// empty one is labelled explicitly instead of producing a blank resource.
func modelName(id string) string {
	if id == "" {
		return "unspecified-model"
	}
	return id
}

// riskForShare maps a model's share of the tenant's monthly spend to a risk
// label for acting on it: the model carrying most of the spend is the most
// disruptive to change.
func riskForShare(share float64) string {
	if share >= highSpendShare {
		return "high"
	}
	if share >= midSpendShare {
		return "medium"
	}
	return "low"
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

// GenerateAlerts returns the tenant's opportunities that are worth surfacing as
// an alert, largest savings first. It used to read them through
// AnalyzeCostSavings, which would have fetched the all-time total twice; it
// reads the opportunities directly instead.
func (s *Service) GenerateAlerts(ctx context.Context, tenantID string) ([]models.CostAlert, error) {
	opportunities, err := s.buildOpportunities(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	alerts := make([]models.CostAlert, 0)
	for _, opp := range opportunities {
		if opp.EstimatedMonthlySavings > alertSavingsFloor {
			alerts = append(alerts, models.CostAlert{
				Type:                    "high_savings_opportunity",
				Category:                opp.Category,
				ResourceName:            opp.ResourceName,
				EstimatedMonthlySavings: opp.EstimatedMonthlySavings,
				RiskLevel:               opp.RiskLevel,
				Description:             opp.Description,
			})
		}
	}
	return alerts, nil
}
