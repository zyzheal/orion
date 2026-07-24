package repository

import (
	"time"
	"context"
	"orion/platform-svc-go/internal/ai-cost/models"
)


// RepositoryInterface defines the data access contract for the ai-cost module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, record *models.CostRecord) (*models.CostRecord, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.CostRecord, error)
	List(ctx context.Context, tenantID string, f models.CostFilter) ([]models.CostRecord, error)
	GetSummary(ctx context.Context, tenantID string, f models.CostFilter) (*models.CostSummary, error)
	GetDailyCosts(ctx context.Context, tenantID string, since time.Time) ([]DailyCost, error)
	GetTopModelsByCost(ctx context.Context, tenantID string, limit int) ([]ModelCost, error)
	DeleteByID(ctx context.Context, tenantID, id string) error
	EnsureTable(ctx context.Context) error
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
