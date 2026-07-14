package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/workflow-task/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("workflow task not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new workflow task row.
func (r *Repository) Create(ctx context.Context, t *models.WorkflowTask) error {
	t.ID = uuid.New().String()
	now := time.Now().UTC()
	t.CreatedAt = now
	t.UpdatedAt = now
	if t.Status == "" {
		t.Status = "pending"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO workflow_tasks (id, tenant_id, workflow_instance_id, name, description,
		     assignee_id, status, form_data, comment, created_by, created_at, updated_at, completed_at)
		 VALUES (:id, :tenantId, :workflowInstanceId, :name, :description,
		     :assigneeId, :status, :formData, :comment, :createdBy, :createdAt, :updatedAt, :completedAt)`,
		t)
	return err
}

// GetByID retrieves a workflow task by id and tenant_id.
func (r *Repository) GetByID(ctx context.Context, id string, tenantID string) (*models.WorkflowTask, error) {
	var t models.WorkflowTask
	err := r.db.GetContext(ctx, &t,
		`SELECT * FROM workflow_tasks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// List retrieves paginated workflow tasks matching the optional filters.
func (r *Repository) List(ctx context.Context, tenantID string, filter *models.ListFilter) ([]models.WorkflowTask, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.AssigneeID != nil && *filter.AssigneeID != "" {
			where += fmt.Sprintf(" AND assignee_id = $%d", argIdx)
			args = append(args, *filter.AssigneeID)
			argIdx++
		}
		if filter.Status != nil && *filter.Status != "" {
			where += fmt.Sprintf(" AND status = $%d", argIdx)
			args = append(args, *filter.Status)
			argIdx++
		}
	}

	// Default pagination
	page := 1
	pageSize := 20
	if filter != nil {
		if filter.Page > 0 {
			page = filter.Page
		}
		if filter.PageSize > 0 {
			pageSize = filter.PageSize
		}
	}
	offset := (page - 1) * pageSize

	where += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, pageSize, offset)

	var tasks []models.WorkflowTask
	err := r.db.SelectContext(ctx, &tasks,
		fmt.Sprintf(`SELECT * FROM workflow_tasks %s`, where), args...)
	return tasks, err
}

// Count returns the total number of tasks matching the optional filters.
func (r *Repository) Count(ctx context.Context, tenantID string, filter *models.ListFilter) (int, error) {
	where := "WHERE tenant_id = $1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.AssigneeID != nil && *filter.AssigneeID != "" {
			where += fmt.Sprintf(" AND assignee_id = $%d", argIdx)
			args = append(args, *filter.AssigneeID)
			argIdx++
		}
		if filter.Status != nil && *filter.Status != "" {
			where += fmt.Sprintf(" AND status = $%d", argIdx)
			args = append(args, *filter.Status)
			argIdx++
		}
	}

	var count int
	err := r.db.GetContext(ctx, &count,
		fmt.Sprintf(`SELECT COUNT(*) FROM workflow_tasks %s`, where), args...)
	return count, err
}

// UpdateStatus updates the status field for a workflow task.
func (r *Repository) UpdateStatus(ctx context.Context, id string, tenantID string, status string) error {
	result, err := r.db.ExecContext(ctx,
		`UPDATE workflow_tasks SET status=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`,
		status, time.Now().UTC(), id, tenantID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// Claim sets the assignee_id and status=assigned for a workflow task.
func (r *Repository) Claim(ctx context.Context, id string, tenantID string, assigneeID string, comment *string) error {
	query := `UPDATE workflow_tasks SET assignee_id=$1, status='assigned', comment=$2, updated_at=$3 WHERE id=$4 AND tenant_id=$5`
	result, err := r.db.ExecContext(ctx, query, assigneeID, comment, time.Now().UTC(), id, tenantID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// Complete sets status=completed, completed_at, form_data, and comment.
func (r *Repository) Complete(ctx context.Context, id string, tenantID string, comment *string, formData *string) error {
	now := time.Now().UTC()
	setClauses := []string{"status = $1", "completed_at = $2", "updated_at = $3"}
	args := []interface{}{"completed", now, now}
	argIdx := 4

	if comment != nil {
		setClauses = append(setClauses, fmt.Sprintf("comment = $%d", argIdx))
		args = append(args, *comment)
		argIdx++
	}
	if formData != nil {
		setClauses = append(setClauses, fmt.Sprintf("form_data = $%d", argIdx))
		args = append(args, *formData)
		argIdx++
	}

	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE workflow_tasks SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), argIdx, argIdx+1)

	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// IsNotFound returns true for database not-found errors.
func IsNotFound(err error) bool {
	return err == sql.ErrNoRows || errors.Is(err, ErrNotFound)
}