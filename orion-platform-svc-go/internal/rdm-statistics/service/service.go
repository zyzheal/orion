// Package service implements the RDM statistics aggregation.
// It queries the rdm_requirements table to compute burndown, velocity,
// defect statistics, and sprint summaries.
package service

import (
	"context"

	"orion/platform-svc-go/internal/rdm-statistics/models"
	"orion/platform-svc-go/internal/repository"
)

// StatsRepository defines the data access methods for RDM statistics.
type StatsRepository interface {
	GetBurndown(ctx context.Context, tenantID, sprintID string) ([]models.BurndownPoint, error)
	GetVelocity(ctx context.Context, tenantID, projectID string, limit int) ([]models.VelocityPoint, error)
	GetDefectStats(ctx context.Context, tenantID, projectID string) (*models.DefectStats, error)
	GetSprintStats(ctx context.Context, tenantID, projectID string) (models.SprintSummaryList, error)
}

// Service computes RDM statistics by delegating to the repository.
type Service struct {
	repo StatsRepository
}

// NewService constructs a Service. Pass nil for a no-op stub service;
// pass a concrete *repository.Repository for real SQL aggregation.
func NewService(repo StatsRepository) *Service {
	return &Service{repo: repo}
}

// GetBurndown returns burndown points for a sprint.
func (s *Service) GetBurndown(ctx context.Context, tenantID, sprintID string) ([]models.BurndownPoint, error) {
	ctx = repository.WithTenant(ctx, tenantID)
	if s.repo == nil {
		return []models.BurndownPoint{}, nil
	}
	return s.repo.GetBurndown(ctx, tenantID, sprintID)
}

// GetVelocity returns velocity points across sprints.
func (s *Service) GetVelocity(ctx context.Context, tenantID, projectID string, limit int) ([]models.VelocityPoint, error) {
	ctx = repository.WithTenant(ctx, tenantID)
	if s.repo == nil {
		return []models.VelocityPoint{}, nil
	}
	if limit <= 0 {
		limit = 10
	}
	return s.repo.GetVelocity(ctx, tenantID, projectID, limit)
}

// GetDefectStats returns defect counts grouped by severity and status.
func (s *Service) GetDefectStats(ctx context.Context, tenantID, projectID string) (*models.DefectStats, error) {
	ctx = repository.WithTenant(ctx, tenantID)
	if s.repo == nil {
		return &models.DefectStats{
			BySeverity: []models.DefectBySeverity{},
			ByStatus:   []models.DefectByStatus{},
		}, nil
	}
	return s.repo.GetDefectStats(ctx, tenantID, projectID)
}

// GetSprintStats returns per-sprint aggregate stats.
func (s *Service) GetSprintStats(ctx context.Context, tenantID, projectID string) (models.SprintSummaryList, error) {
	ctx = repository.WithTenant(ctx, tenantID)
	if s.repo == nil {
		return models.SprintSummaryList{}, nil
	}
	return s.repo.GetSprintStats(ctx, tenantID, projectID)
}
