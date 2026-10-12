package repository

import (
	"context"

	"orion/platform-svc-go/internal/workflow-dependency/models"
	internalrepo "orion/platform-svc-go/internal/repository"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	internalrepo.TenantAwareRepository[any]
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{
		TenantAwareRepository: internalrepo.NewTenantAwareRepository(db),
	}
}

func (r *Repository) GetAllWorkflows(ctx context.Context, tenantID string) ([]models.WorkflowDefinitionRow, error) {
	var rows []models.WorkflowDefinitionRow
	err := r.Select(ctx, &rows,
		`SELECT id, name, nodes, edges FROM lowcode_workflow_definition`)
	if err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []models.WorkflowDefinitionRow{}
	}
	return rows, nil
}

func (r *Repository) GetWorkflowByID(ctx context.Context, id string, tenantID string) (*models.WorkflowDefinitionRow, error) {
	var row models.WorkflowDefinitionRow
	err := r.Get(ctx, &row,
		`SELECT id, name, nodes, edges FROM lowcode_workflow_definition WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &row, nil
}
