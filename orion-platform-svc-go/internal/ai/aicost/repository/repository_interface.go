package repository

import "context"
import "orion/platform-svc-go/internal/ai/aicost/models"

// RepositoryInterface defines the database operations for AI cost tracking.
type RepositoryInterface interface {
	CreateSavingsRecord(ctx context.Context, record *models.SavingsRecord) error
	ListSavingsHistory(ctx context.Context, tenantID string) ([]models.SavingsRecord, error)
	GetTotalSavings(ctx context.Context, tenantID string) (float64, error)
	GetTotalSpend(ctx context.Context, tenantID string) (float64, error)
}

// Ensure Repository implements RepositoryInterface at compile time.
var _ RepositoryInterface = (*Repository)(nil)
