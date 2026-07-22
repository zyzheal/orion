package repository

import (
	"context"
	"orion/platform-svc-go/internal/api-consumption/models"
)


// RepositoryInterface defines the data access contract for the api-consumption module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateConsumption(ctx context.Context, cons *models.Consumption) error
	ListConsumptions(ctx context.Context, tenantID string, filter *models.ConsumptionFilter) ([]models.Consumption, error)
	CreateLimit(ctx context.Context, limit *models.Limit) error
	GetLimitByID(ctx context.Context, tenantID, id string) (*models.Limit, error)
	ListLimits(ctx context.Context, tenantID string) ([]models.Limit, error)
	UpdateLimit(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Limit, error)
	DeleteLimit(ctx context.Context, tenantID, id string) (bool, error)
	GetStats(ctx context.Context, tenantID string) (*models.ConsumptionStats, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
