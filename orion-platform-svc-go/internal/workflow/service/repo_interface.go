package service

import (
	"context"
	"orion/platform-svc-go/internal/workflow/models"
)

// WorkflowRepo defines the repository interface for testing.
type WorkflowRepo interface {
	Create(ctx context.Context, wf *models.Workflow) error
	GetByID(ctx context.Context, id string, tenantID string) (*models.Workflow, error)
	List(ctx context.Context, tenantID string, status *string, limit, offset int) ([]models.Workflow, error)
	Count(ctx context.Context, tenantID string, status *string) (int, error)
	Update(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.Workflow, error)
	Delete(ctx context.Context, id string, tenantID string) (bool, error)
	SetEnabled(ctx context.Context, id string, tenantID string, enabled bool) (*models.Workflow, error)
	CreateExecution(ctx context.Context, exec *models.WorkflowExecution) error
	GetExecutionByID(ctx context.Context, id string, tenantID string) (*models.WorkflowExecution, error)
	ListExecutionsByWorkflowID(ctx context.Context, workflowID string, tenantID string, limit, offset int) ([]models.WorkflowExecution, error)
	CountExecutionsByWorkflowID(ctx context.Context, workflowID string, tenantID string) (int, error)
}
