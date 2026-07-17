package service

import (
	"context"

	"orion/platform-svc-go/internal/ai-decisions/models"
	"orion/platform-svc-go/internal/ai-decisions/repository"
)

// DecisionRepo abstracts database access for AIDecision entities.
// Implementations include the concrete *repository.Repository and test mocks.
type DecisionRepo interface {
	CreateDecision(ctx context.Context, d *models.AIDecision) error
	GetByID(ctx context.Context, id string, tenantID string) (*models.AIDecision, error)
	List(ctx context.Context, tenantID string, filter *repository.ListFilter) ([]models.AIDecision, error)
	Count(ctx context.Context, tenantID string, filter *repository.ListFilter) (int64, error)
	UpdateDecisionStatus(ctx context.Context, id string, tenantID string, status models.DecisionStatus, executedAt *int64) (*models.AIDecision, error)
	Delete(ctx context.Context, id string, tenantID string) (bool, error)
	CreateFeedback(ctx context.Context, fb *models.DecisionFeedback) error
	CreateTraces(ctx context.Context, traces []*models.DecisionTrace) error
	GetTraces(ctx context.Context, decisionID string, tenantID string) ([]models.DecisionTrace, error)
	DeleteTraces(ctx context.Context, decisionID string, tenantID string) error
	DeleteFeedbacks(ctx context.Context, decisionID string, tenantID string) error
	GetStats(ctx context.Context, tenantID string, dateRange *models.DateRange) (*models.DecisionStats, error)
}
