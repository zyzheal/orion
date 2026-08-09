package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/task-executor/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository provides CRUD operations for task-executor tasks.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new task record.
func (r *Repository) Create(ctx context.Context, task *models.Task) error {
	task.ID = uuid.New().String()
	now := time.Now().UTC()
	task.CreatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO tasks (id, tenant_id, type, name, description, input, output, status, timeout_sec, created_at, completed_at)
		 VALUES (:id, :tenant_id, :type, :name, :description, :input, :output, :status, :timeout_sec, :created_at, :completed_at)`,
		task)
	return err
}

// GetByID retrieves a task by its ID and tenant ID.
func (r *Repository) GetByID(ctx context.Context, id, tenantID string) (*models.Task, error) {
	var task models.Task
	err := r.db.GetContext(ctx, &task,
		`SELECT * FROM tasks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, sentinel.NotFound
		}
		return nil, err
	}
	return &task, nil
}

// GetAll returns all tasks for a tenant, with optional status filter and pagination.
func (r *Repository) GetAll(ctx context.Context, tenantID, status string, limit, offset int) ([]models.Task, int64, error) {
	var tasks []models.Task

	query := `SELECT * FROM tasks WHERE tenant_id = $1`
	var countQuery = `SELECT COUNT(*) FROM tasks WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	countArgs := []interface{}{tenantID}
	argIdx := 2

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, status)
		countArgs = append(countArgs, status)
		argIdx++
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	err := r.db.SelectContext(ctx, &tasks, query, args...)
	if err != nil {
		return nil, 0, err
	}

	var total int64
	err = r.db.GetContext(ctx, &total, countQuery, countArgs...)
	if err != nil {
		return nil, 0, err
	}

	return tasks, total, nil
}

// Update applies updates to an existing task by ID and tenant ID.
func (r *Repository) Update(ctx context.Context, task *models.Task) error {
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE tasks SET
			 status=:status,
			 output=:output,
			 timeout_sec=:timeout_sec,
			 completed_at=:completed_at
		 WHERE id=:id AND tenant_id=:tenant_id`,
		task)
	if err != nil {
		return err
	}
	return nil
}

// UpdateStatus updates only the status of a task.
func (r *Repository) UpdateStatus(ctx context.Context, id, tenantID, status string) error {
	result, err := r.db.ExecContext(ctx,
		`UPDATE tasks SET status=$3 WHERE id=$1 AND tenant_id=$2`, id, tenantID, status)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}

// UpdateCompletedAt sets the completed_at timestamp for a task.
func (r *Repository) UpdateCompletedAt(ctx context.Context, id, tenantID string, completedAt *time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE tasks SET completed_at=$3 WHERE id=$1 AND tenant_id=$2`, id, tenantID, completedAt)
	return err
}

// Delete removes a task by ID and tenant ID.
func (r *Repository) Delete(ctx context.Context, id, tenantID string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM tasks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}
