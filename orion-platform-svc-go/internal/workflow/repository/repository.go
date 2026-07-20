package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/workflow/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Workflow Definitions ---

func (r *Repository) Create(ctx context.Context, wf *models.Workflow) error {
	wf.ID = uuid.New().String()
	now := time.Now().UTC()
	wf.CreatedAt = now
	wf.UpdatedAt = now
	if wf.Version == "" {
		wf.Version = "1.0"
	}
	if wf.Nodes == "" {
		wf.Nodes = "[]"
	}
	if wf.Edges == "" {
		wf.Edges = "[]"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO lowcode_workflow_definition
			(id, tenant_id, name, description, nodes, edges, enabled, version, created_by, created_at, updated_at)
		 VALUES
			(:id, :tenantId, :name, :description, :nodes, :edges, :enabled, :version, :createdBy, :createdAt, :updatedAt)`,
		wf)
	return err
}

func (r *Repository) GetByID(ctx context.Context, id string, tenantID string) (*models.Workflow, error) {
	var wf models.Workflow
	err := r.db.GetContext(ctx, &wf,
		`SELECT * FROM lowcode_workflow_definition WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &wf, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, status *string, limit, offset int) ([]models.Workflow, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2
	if status != nil && *status != "" {
		if *status == "enabled" {
			where += fmt.Sprintf(" AND enabled = $%d", argIdx)
			args = append(args, true)
		} else if *status == "disabled" {
			where += fmt.Sprintf(" AND enabled = $%d", argIdx)
			args = append(args, false)
		}
		argIdx++
	}
	args = append(args, limit, offset)
	query := fmt.Sprintf(`SELECT * FROM lowcode_workflow_definition %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, argIdx, argIdx+1)
	var wfs []models.Workflow
	err := r.db.SelectContext(ctx, &wfs, query, args...)
	return wfs, err
}

func (r *Repository) Count(ctx context.Context, tenantID string, status *string) (int, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2
	if status != nil && *status != "" {
		if *status == "enabled" {
			where += fmt.Sprintf(" AND enabled = $%d", argIdx)
			args = append(args, true)
		} else if *status == "disabled" {
			where += fmt.Sprintf(" AND enabled = $%d", argIdx)
			args = append(args, false)
		}
		argIdx++
	}
	var count int
	err := r.db.GetContext(ctx, &count,
		fmt.Sprintf(`SELECT COUNT(*) FROM lowcode_workflow_definition %s`, where), args...)
	return count, err
}

func (r *Repository) Update(ctx context.Context, id string, tenantID string, updates map[string]interface{}) (*models.Workflow, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE lowcode_workflow_definition SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetByID(ctx, id, tenantID)
}

func (r *Repository) Delete(ctx context.Context, id string, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM lowcode_workflow_definition WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

func (r *Repository) SetEnabled(ctx context.Context, id string, tenantID string, enabled bool) (*models.Workflow, error) {
	now := time.Now().UTC()
	result, err := r.db.ExecContext(ctx,
		`UPDATE lowcode_workflow_definition SET enabled=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
		enabled, now, id, tenantID)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetByID(ctx, id, tenantID)
}

// --- Workflow Executions ---

func (r *Repository) CreateExecution(ctx context.Context, exec *models.WorkflowExecution) error {
	exec.ID = uuid.New().String()
	exec.CreatedAt = time.Now().UTC()
	if exec.Status == "" {
		exec.Status = "pending"
	}
	if exec.Input == "" {
		exec.Input = "{}"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO lowcode_workflow_instance
			(id, workflow_id, workflow_definition_id, status, input, output, current_node_id, triggered_by, started_at, completed_at, created_at)
		 VALUES
			(:id, :workflowId, :workflowDefinitionId, :status, :input, :output, :currentNodeId, :triggeredBy, :startedAt, :completedAt, :createdAt)`,
		exec)
	return err
}

func (r *Repository) GetExecutionByID(ctx context.Context, id string, tenantID string) (*models.WorkflowExecution, error) {
	var exec models.WorkflowExecution
	err := r.db.GetContext(ctx, &exec,
		`SELECT e.* FROM lowcode_workflow_instance e
		 JOIN lowcode_workflow_definition d ON d.id = e.workflow_id
		 WHERE e.id=$1 AND d.tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &exec, nil
}

func (r *Repository) ListExecutionsByWorkflowID(ctx context.Context, workflowID string, tenantID string, limit, offset int) ([]models.WorkflowExecution, error) {
	var execs []models.WorkflowExecution
	err := r.db.SelectContext(ctx, &execs,
		`SELECT e.* FROM lowcode_workflow_instance e
		 JOIN lowcode_workflow_definition d ON d.id = e.workflow_id
		 WHERE e.workflow_id=$1 AND d.tenant_id=$2
		 ORDER BY e.created_at DESC LIMIT $3 OFFSET $4`,
		workflowID, tenantID, limit, offset)
	return execs, err
}

func (r *Repository) CountExecutionsByWorkflowID(ctx context.Context, workflowID string, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM lowcode_workflow_instance e
		 JOIN lowcode_workflow_definition d ON d.id = e.workflow_id
		 WHERE e.workflow_id=$1 AND d.tenant_id=$2`,
		workflowID, tenantID)
	return count, err
}
