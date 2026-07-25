package service

import (
	"context"
	"fmt"
	"math"

	"orion/platform-svc-go/internal/finops/finops/models"
	"orion/platform-svc-go/internal/finops/finops/repository"

	"github.com/google/uuid"
)

// OptimizationService manages cost optimization recommendations.
type OptimizationService struct {
	costRepo *repository.CostRepository
}

func NewOptimizationService(costRepo *repository.CostRepository) *OptimizationService {
	return &OptimizationService{costRepo: costRepo}
}

// AnalyzeUtilization generates optimization suggestions from resource utilization data.
func (s *OptimizationService) AnalyzeUtilization(ctx context.Context, tenantID string, req models.AnalyzeOptimizationRequest) ([]models.CostOptimization, error) {
	var optimizations []models.CostOptimization

	for _, u := range req.Utilizations {
		// Record the utilization data
		util := &models.ResourceUtilization{
			ID:                 uuid.New().String(),
			TenantID:           tenantID,
			ResourceID:         u.ResourceID,
			ResourceType:       u.ResourceType,
			ResourceName:       u.ResourceName,
			CPUUtilization:     u.CPUUtilization,
			MemoryUtilization:  u.MemoryUtilization,
			StorageUtilization: u.StorageUtilization,
			MonthlyCostCents:   u.MonthlyCostCents,
			Environment:        u.Environment,
		}
		if err := s.costRepo.RecordResourceUtilization(ctx, util); err != nil {
			continue
		}

		// Generate right-sizing recommendation if underutilized
		if u.CPUUtilization < 30 && u.MemoryUtilization < 30 && u.MonthlyCostCents > 0 {
			savings := int64(float64(u.MonthlyCostCents) * 0.3) // estimate 30% savings
			opt := models.CostOptimization{
				ID:                    uuid.New().String(),
				TenantID:              tenantID,
				Category:              models.OptRightSizing,
				Description:           fmt.Sprintf("Resource %s (%s) is underutilized: CPU %.1f%%, Memory %.1f%%", u.ResourceName, u.ResourceID, u.CPUUtilization, u.MemoryUtilization),
				EstimatedSavingsCents: savings,
				Effort:                2,
				Priority:              models.PriorityMedium,
				Status:                models.OptStatusIdentified,
				ResourceIDs:           models.JSONB{"resource_id": u.ResourceID},
				EntityType:            "resource",
				EntityID:              u.ResourceID,
			}
			optimizations = append(optimizations, opt)
		}

		// Detect unused resources
		if u.CPUUtilization < 5 && u.MemoryUtilization < 5 && u.MonthlyCostCents > 0 {
			opt := models.CostOptimization{
				ID:                    uuid.New().String(),
				TenantID:              tenantID,
				Category:              models.OptUnusedResources,
				Description:           fmt.Sprintf("Resource %s (%s) appears unused: CPU %.1f%%, Memory %.1f%%", u.ResourceName, u.ResourceID, u.CPUUtilization, u.MemoryUtilization),
				EstimatedSavingsCents: u.MonthlyCostCents,
				Effort:                1,
				Priority:              models.PriorityHigh,
				Status:                models.OptStatusIdentified,
				ResourceIDs:           models.JSONB{"resource_id": u.ResourceID},
				EntityType:            "resource",
				EntityID:              u.ResourceID,
			}
			optimizations = append(optimizations, opt)
		}
	}

	if len(optimizations) > 0 {
		if err := s.costRepo.BatchCreateOptimizations(ctx, optimizations); err != nil {
			return nil, fmt.Errorf("batch create optimizations: %w", err)
		}
	}

	return optimizations, nil
}

// GenerateRightSizingRecommendations generates right-sizing recommendations from current utilizations.
func (s *OptimizationService) GenerateRightSizingRecommendations(ctx context.Context, tenantID string) ([]models.RightSizingRecommendation, error) {
	utils, err := s.costRepo.GetResourceUtilizations(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	var recs []models.RightSizingRecommendation
	for _, u := range utils {
		if u.CPUUtilization < 40 || u.MemoryUtilization < 40 {
			// Estimate recommended specs based on utilization
			cpuScale := math.Max(u.CPUUtilization/70.0, 0.5) // target 70% utilization, min 50%
			memScale := math.Max(u.MemoryUtilization/70.0, 0.5)

			currentCost := u.MonthlyCostCents
			estimatedCost := int64(float64(currentCost) * (cpuScale + memScale) / 2)
			savings := currentCost - estimatedCost

			if savings > 0 {
				rec := models.RightSizingRecommendation{
					ID:                    uuid.New().String(),
					ResourceID:            u.ResourceID,
					ResourceType:          u.ResourceType,
					CurrentSpec:           map[string]interface{}{"cpu_utilization": u.CPUUtilization, "memory_utilization": u.MemoryUtilization},
					RecommendedSpec:       map[string]interface{}{"target_cpu_utilization": 70.0, "target_memory_utilization": 70.0, "scale_factor": (cpuScale + memScale) / 2},
					CurrentCostCents:      currentCost,
					EstimatedCostCents:    estimatedCost,
					EstimatedSavingsCents: savings,
					Reason:                fmt.Sprintf("CPU at %.1f%%, Memory at %.1f%% — can reduce to %.0f%% capacity", u.CPUUtilization, u.MemoryUtilization, (cpuScale+memScale)/2*100),
					TenantID:              tenantID,
				}
				recs = append(recs, rec)
			}
		}
	}

	return recs, nil
}

// GetUnusedResources returns resources with very low utilization.
func (s *OptimizationService) GetUnusedResources(ctx context.Context, tenantID string) ([]models.ResourceUtilization, error) {
	return s.costRepo.GetUnusedResources(ctx, tenantID)
}

// GetSavingsEstimate returns total estimated savings.
func (s *OptimizationService) GetSavingsEstimate(ctx context.Context, tenantID string, category models.OptimizationCategory, status models.OptimizationStatus) (*models.SavingsEstimate, error) {
	return s.costRepo.GetOptimizationSavings(ctx, tenantID, category, status)
}

// ListOptimizations returns optimization suggestions with filters.
func (s *OptimizationService) ListOptimizations(ctx context.Context, tenantID string, category models.OptimizationCategory, status models.OptimizationStatus) ([]models.CostOptimization, error) {
	return s.costRepo.GetOptimizations(ctx, tenantID, category, status)
}

// UpdateStatus updates the status of an optimization suggestion.
func (s *OptimizationService) UpdateStatus(ctx context.Context, tenantID, id string, status models.OptimizationStatus) error {
	return s.costRepo.UpdateOptimizationStatus(ctx, tenantID, id, status)
}

// Delete deletes an optimization suggestion.
func (s *OptimizationService) Delete(ctx context.Context, tenantID, id string) error {
	return s.costRepo.DeleteOptimization(ctx, tenantID, id)
}
