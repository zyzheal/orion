package repository

import (
	"context"
	"orion/platform-svc-go/internal/execution-mode-engine/models"
)

type ExecutionModeRepository interface {
	Create(ctx context.Context, config *models.ExecutionModeConfig) error
	GetByID(ctx context.Context, tenantID, id string) (*models.ExecutionModeConfig, error)
	List(ctx context.Context, tenantID string) ([]models.ExecutionModeConfig, error)
	Update(ctx context.Context, config *models.ExecutionModeConfig) error
	Delete(ctx context.Context, tenantID, id string) error
}

type executionModeRepo struct{}

func NewRepository() ExecutionModeRepository {
	return &executionModeRepo{}
}

func (r *executionModeRepo) Create(ctx context.Context, config *models.ExecutionModeConfig) error { return nil }
func (r *executionModeRepo) GetByID(ctx context.Context, tenantID, id string) (*models.ExecutionModeConfig, error) { return nil, nil }
func (r *executionModeRepo) List(ctx context.Context, tenantID string) ([]models.ExecutionModeConfig, error) { return nil, nil }
func (r *executionModeRepo) Update(ctx context.Context, config *models.ExecutionModeConfig) error { return nil }
func (r *executionModeRepo) Delete(ctx context.Context, tenantID, id string) error { return nil }
