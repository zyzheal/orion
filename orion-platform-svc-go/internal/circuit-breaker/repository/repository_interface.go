package repository

import (
	"context"
	"orion/platform-svc-go/internal/circuit-breaker/models"
)


// RepositoryInterface defines the data access contract for the circuit-breaker module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	Create(ctx context.Context, cb *models.CircuitBreaker) error
	GetByID(ctx context.Context, id, tenantID string) (*models.CircuitBreaker, error)
	List(ctx context.Context, tenantID string) ([]models.CircuitBreaker, error)
	Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.CircuitBreaker, error)
	Delete(ctx context.Context, id, tenantID string) (bool, error)
	UpdateState(ctx context.Context, cbID, tenantID, newState, reason string) error
	IncrementFailures(ctx context.Context, cbID, tenantID string) (int, error)
	ResetFailures(ctx context.Context, cbID, tenantID string) error
	ListOpen(ctx context.Context, tenantID string) ([]models.CircuitBreaker, error)
	GetRecentEvents(ctx context.Context, cbID, tenantID string, limit int) ([]models.CircuitEvent, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
