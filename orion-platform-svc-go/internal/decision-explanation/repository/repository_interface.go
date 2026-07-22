package repository

import (
	"context"
	"orion/platform-svc-go/internal/decision-explanation/models"
)


// RepositoryInterface defines the data access contract for the decision-explanation module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, item *models.DecisionExplanation) error
	GetByID(ctx context.Context, tenantID, id string) (*models.DecisionExplanation, error)
	List(ctx context.Context, tenantID string) ([]models.DecisionExplanation, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.DecisionExplanation, error)
	Delete(ctx context.Context, tenantID, id string) (bool, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
