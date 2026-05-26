package service

import (
	"context"
	"fmt"
	"orion/deploy-svc-go/internal/models"
	"orion/deploy-svc-go/internal/repository"
	"time"
)

type DeployService struct {
	repo *repository.DeploymentRepository
}

func NewDeployService(repo *repository.DeploymentRepository) *DeployService {
	return &DeployService{repo: repo}
}

func (s *DeployService) Create(ctx context.Context, d *models.Deployment) error {
	if d.Status == "" {
		d.Status = "pending"
	}
	return s.repo.Create(ctx, d)
}

func (s *DeployService) GetByID(ctx context.Context, tenantID, id string) (*models.Deployment, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *DeployService) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Deployment, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *DeployService) Update(ctx context.Context, d *models.Deployment) error {
	return s.repo.Update(ctx, d)
}

func (s *DeployService) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *DeployService) Rollback(ctx context.Context, tenantID, id string) (*models.Deployment, error) {
	current, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("deployment not found: %w", err)
	}

	rollbackVersion := current.RollbackTo
	if rollbackVersion == nil || *rollbackVersion == "" {
		// Find the previous successful deployment
		deployments, err := s.repo.List(ctx, tenantID, 0, 10)
		if err != nil {
			return nil, fmt.Errorf("failed to find rollback target: %w", err)
		}

		for _, dep := range deployments {
			if dep.ID != current.ID && dep.Status == "success" && dep.ServiceName == current.ServiceName && dep.Environment == current.Environment {
				v := dep.Version
				rollbackVersion = &v
				break
			}
		}

		if rollbackVersion == nil {
			return nil, fmt.Errorf("no previous deployment found for rollback")
		}
	}

	rollbackDeployment := &models.Deployment{
		TenantID:    tenantID,
		Environment: current.Environment,
		ServiceName: current.ServiceName,
		Version:     *rollbackVersion,
		ImageTag:    current.ImageTag,
		Status:      "rollback",
		DeployedBy:  current.DeployedBy,
	}

	if err := s.repo.Create(ctx, rollbackDeployment); err != nil {
		return nil, err
	}

	// Update current deployment status
	_ = s.repo.UpdateStatus(ctx, tenantID, id, "rollback")

	return rollbackDeployment, nil
}

func newTimestamp() *time.Time {
	t := time.Now()
	return &t
}
