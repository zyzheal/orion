package repository

import (
	"context"
	"orion/platform-svc-go/internal/ai-decisions/models"
)


// RepositoryInterface defines the data access contract for the ai-decisions module.
// DO NOT MODIFY: auto-generated from repository.go
type RepositoryInterface interface {
	CreateDecision(ctx context.Context, d *models.AIDecision) error
	GetByID(ctx context.Context, id string, tenantID string) (*models.AIDecision, error)
	List(ctx context.Context, tenantID string, filter *ListFilter) ([]models.AIDecision, error)
	Count(ctx context.Context, tenantID string, filter *ListFilter) (int64, error)
	UpdateDecisionStatus(ctx context.Context, id string, tenantID string, status models.DecisionStatus, executedAt *int64) (*models.AIDecision, error)
	Delete(ctx context.Context, id string, tenantID string) (bool, error)
	CreateFeedback(ctx context.Context, fb *models.DecisionFeedback) error
	GetFeedbacks(ctx context.Context, decisionID string, tenantID string) ([]models.DecisionFeedback, error)
	CreateTrace(ctx context.Context, t *models.DecisionTrace) error
	CreateTraces(ctx context.Context, traces []*models.DecisionTrace) error
	GetTraces(ctx context.Context, decisionID string, tenantID string) ([]models.DecisionTrace, error)
	DeleteTraces(ctx context.Context, decisionID string, tenantID string) error
	DeleteFeedbacks(ctx context.Context, decisionID string, tenantID string) error
	GetStats(ctx context.Context, tenantID string, dateRange *models.DateRange) (*models.DecisionStats, error)
}

// Ensure Repository implements RepositoryInterface.
var _ RepositoryInterface = (*Repository)(nil)
