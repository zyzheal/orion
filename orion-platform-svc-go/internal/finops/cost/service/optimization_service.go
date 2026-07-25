package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/finops/cost/models"
	"orion/platform-svc-go/internal/finops/cost/repository"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// OptimizationService provides cost optimization recommendations.
type OptimizationService struct {
	repo   *repository.CostRepository
	logger *zap.Logger
}

// NewOptimizationService creates a new optimization service instance.
func NewOptimizationService(repo *repository.CostRepository, logger *zap.Logger) *OptimizationService {
	return &OptimizationService{repo: repo, logger: logger}
}

// AnalyzeUtilization analyzes resource utilization and generates recommendations.
func (s *OptimizationService) AnalyzeUtilization(ctx context.Context, tenantID string, records []models.UtilizationRecord) *models.UtilizationAnalysis {
	analysis := &models.UtilizationAnalysis{
		TenantID: tenantID,
		ByCategory: map[models.OptimizationCategory]int{
			models.OptUnusedResources:    0,
			models.OptRightSizing:        0,
			models.OptScheduling:         0,
			models.OptReservedInstances:  0,
			models.OptSpotInstances:      0,
			models.OptStorageOptimization: 0,
			models.OptNetworkOptimization: 0,
		},
		AnalyzedAt: time.Now(),
	}

	var potentialSavings float64

	for _, r := range records {
		if isUnused(r) {
			analysis.UnusedResources++
			potentialSavings += r.MonthlyCost
			analysis.ByCategory[models.OptUnusedResources]++
		} else if isUnderutilized(r) {
			analysis.UnderutilizedResources++
			potentialSavings += r.MonthlyCost * 0.3
			analysis.ByCategory[models.OptRightSizing]++
		} else {
			analysis.OptimalResources++
		}
	}

	analysis.TotalResources = len(records)
	analysis.PotentialMonthlySavings = roundFloat(potentialSavings)

	return analysis
}

// GenerateSuggestions generates optimization suggestions based on utilization records.
func (s *OptimizationService) GenerateSuggestions(ctx context.Context, tenantID string, records []models.UtilizationRecord) []models.OptimizationRecommendation {
	var suggestions []models.OptimizationRecommendation

	for _, r := range records {
		if isUnused(r) {
			suggestions = append(suggestions, s.newUnusedSuggestion(tenantID, r))
		} else if isUnderutilized(r) {
			suggestions = append(suggestions, s.newRightSizingSuggestion(tenantID, r))
		} else if r.Environment != "production" && r.CPUUtilization < 50 {
			suggestions = append(suggestions, s.newSchedulingSuggestion(tenantID, r))
		}
	}

	return suggestions
}

// ListSuggestions retrieves optimization suggestions for a tenant.
func (s *OptimizationService) ListSuggestions(ctx context.Context, tenantID string, params models.GetOptimizationsQueryParams) ([]models.OptimizationRecommendation, error) {
	opts, err := s.repo.GetOptimizations(ctx, tenantID, string(params.Category), string(params.Status), 0, 100)
	if err != nil {
		return nil, err
	}

	var result []models.OptimizationRecommendation
	for _, o := range opts {
		if params.MinSavings > 0 && o.EstimatedSavings < params.MinSavings {
			continue
		}
		var resourceIDs []string
			if o.ResourceIDs != nil {
				resourceIDs = o.ResourceIDs
			}
		result = append(result, models.OptimizationRecommendation{
			ID:               o.ID,
			TenantID:         o.TenantID,
			Category:         o.Category,
			Priority:         o.Priority,
			Status:           o.Status,
			ResourceIDs:      resourceIDs,
			Description:      o.Description,
			EstimatedSavings: o.EstimatedSavings,
			Effort:           o.Effort,
			CreatedAt:        o.CreatedAt,
		})
	}

	return result, nil
}

func (s *OptimizationService) newUnusedSuggestion(tenantID string, r models.UtilizationRecord) models.OptimizationRecommendation {
	return models.OptimizationRecommendation{
		ID:               uuid.New().String(),
		TenantID:         tenantID,
		Category:         models.OptUnusedResources,
		Priority:         models.PriorityCritical,
		Status:           models.OptStatusIdentified,
		ResourceIDs:      []string{r.ResourceID},
		Description:      fmt.Sprintf("Resource %s is unused. CPU: %.1f%%, Memory: %.1f%%, Storage: %.1f%%. Consider terminating.", r.ResourceName, r.CPUUtilization, r.MemoryUtilization, r.StorageUtilization),
		EstimatedSavings: r.MonthlyCost,
		Effort:           1,
		CreatedAt:        time.Now(),
		Metadata: models.JSONB{
			"environment": r.Environment,
		},
	}
}

func (s *OptimizationService) newRightSizingSuggestion(tenantID string, r models.UtilizationRecord) models.OptimizationRecommendation {
	savings := r.MonthlyCost * 0.3
	return models.OptimizationRecommendation{
		ID:               uuid.New().String(),
		TenantID:         tenantID,
		Category:         models.OptRightSizing,
		Priority:         models.PriorityMedium,
		Status:           models.OptStatusIdentified,
		ResourceIDs:      []string{r.ResourceID},
		Description:      fmt.Sprintf("Resource %s is underutilized. Right-sizing could save ~$%.2f/month.", r.ResourceName, savings),
		EstimatedSavings: roundFloat(savings),
		Effort:           2,
		CreatedAt:        time.Now(),
		Metadata: models.JSONB{
			"environment": r.Environment,
		},
	}
}

func (s *OptimizationService) newSchedulingSuggestion(tenantID string, r models.UtilizationRecord) models.OptimizationRecommendation {
	savings := r.MonthlyCost * 0.4
	return models.OptimizationRecommendation{
		ID:               uuid.New().String(),
		TenantID:         tenantID,
		Category:         models.OptScheduling,
		Priority:         models.PriorityMedium,
		Status:           models.OptStatusIdentified,
		ResourceIDs:      []string{r.ResourceID},
		Description:      fmt.Sprintf("Resource %s in %s environment has low utilization. Consider scheduling to run only during business hours.", r.ResourceName, r.Environment),
		EstimatedSavings: roundFloat(savings),
		Effort:           3,
		CreatedAt:        time.Now(),
		Metadata: models.JSONB{
			"environment": r.Environment,
		},
	}
}

func isUnused(r models.UtilizationRecord) bool {
	return r.CPUUtilization < 5 && r.MemoryUtilization < 5 && r.StorageUtilization < 5
}

func isUnderutilized(r models.UtilizationRecord) bool {
	return r.CPUUtilization < 30 || r.MemoryUtilization < 30
}
