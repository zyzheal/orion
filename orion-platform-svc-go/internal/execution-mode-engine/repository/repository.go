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

type executionModeRepository struct{}

func NewExecutionModeRepository() ExecutionModeRepository {
	return &executionModeRepository{}
}

func (r *executionModeRepository) Create(ctx context.Context, config *models.ExecutionModeConfig) error { return nil }
func (r *executionModeRepository) GetByID(ctx context.Context, tenantID, id string) (*models.ExecutionModeConfig, error) { return nil, nil }
func (r *executionModeRepository) List(ctx context.Context, tenantID string) ([]models.ExecutionModeConfig, error) { return nil, nil }
func (r *executionModeRepository) Update(ctx context.Context, config *models.ExecutionModeConfig) error { return nil }
func (r *executionModeRepository) Delete(ctx context.Context, tenantID, id string) error { return nil }
