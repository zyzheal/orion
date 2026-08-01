package repository

import (
	"context"
	"orion/platform-svc-go/internal/ai-review/models"
)


// RepositoryInterface defines the data access contract for the ai-review module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, m *models.ReviewRequest) error
	GetByID(ctx context.Context, tenantID, id string) (*models.ReviewRequest, error)
	List(ctx context.Context, tenantID string, q models.ListReviewsQuery) ([]models.ReviewRequest, error)
	Count(ctx context.Context, tenantID string, q models.ListReviewsQuery) (int, error)
	UpdateStatus(ctx context.Context, tenantID, id string, status string) error
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
