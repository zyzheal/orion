package repository

import (
	"context"

	"orion/platform-svc-go/internal/workflow-dependency/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) GetAllWorkflows(ctx context.Context, tenantID string) ([]models.WorkflowDefinitionRow, error) {
	var rows []models.WorkflowDefinitionRow
	err := r.db.SelectContext(ctx, &rows,
		`SELECT id, name, nodes, edges FROM lowcode_workflow_definition WHERE tenant_id=$1`, tenantID)
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
	err := r.db.GetContext(ctx, &row,
		`SELECT id, name, nodes, edges FROM lowcode_workflow_definition WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &row, nil
}