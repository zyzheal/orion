package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/platform-svc-go/internal/task-timeout/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// ErrNotFound indicates a task was not found.
var ErrNotFound = errors.New("task not found")

// Repository provides data access for the task-timeout checker.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// GetTimedOutTasks returns workflow tasks that have exceeded their due_date
// and are not yet completed/cancelled.
//
// The task table is named "workflow_tasks" and follows the TS
// WorkflowTaskRepository contract.
func (r *Repository) GetTimedOutTasks(ctx context.Context) ([]models.TimeoutTask, error) {
	now := time.Now()

	query := `
		SELECT
			id        AS task_id,
			title,
			instance_id,
			due_date,
			actual_due_date,
			status,
			created_at
		FROM workflow_tasks
		WHERE due_date IS NOT NULL
		  AND due_date < $1
		  AND status NOT IN ('completed', 'cancelled', 'skipped', 'done')
		ORDER BY due_date ASC
	`

	var rows []struct {
		TaskID        string     `db:"task_id"`
		Title         string     `db:"title"`
		InstanceID    string     `db:"instance_id"`
		DueDate       time.Time  `db:"due_date"`
		ActualDueDate *time.Time `db:"actual_due_date"`
		Status        string     `db:"status"`
		CreatedAt     time.Time  `db:"created_at"`
	}

	err := r.db.SelectContext(ctx, &rows, query, now)
	if err != nil {
		return nil, err
	}

	var result []models.TimeoutTask
	for _, row := range rows {
		task := models.TimeoutTask{
			TaskID:        row.TaskID,
			Title:         row.Title,
			InstanceID:    row.InstanceID,
			DueDate:       row.DueDate,
			ActualDueDate: row.ActualDueDate,
			Status:        row.Status,
			CreatedAt:     row.CreatedAt,
		}
		task.OverdueHours = hoursAfter(row.DueDate, now)
		result = append(result, task)
	}

	return result, nil
}

// GetTaskByID fetches a single workflow task by its ID.
func (r *Repository) GetTaskByID(ctx context.Context, tenantID, id string) (*models.TimeoutTask, error) {
	var task models.TimeoutTask
	err := r.db.GetContext(ctx, &task,
		"SELECT id AS task_id, title, instance_id, due_date, actual_due_date, status, created_at FROM workflow_tasks WHERE id = $1 AND tenant_id = $2",
		id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	task.OverdueHours = hoursAfter(task.DueDate, time.Now())
	return &task, nil
}

// SetTaskStatus updates the status of a workflow task.
func (r *Repository) SetTaskStatus(ctx context.Context, id, status string) error {
	_, err := r.db.ExecContext(ctx,
		"UPDATE workflow_tasks SET status = $1 WHERE id = $2", status, id)
	return err
}

// CreateTimeoutEvent records a timeout action event for auditing.
func (r *Repository) CreateTimeoutEvent(ctx context.Context, tenantID, taskID, instanceID string, action models.TimeoutAction) error {
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO task_timeout_events (id, tenant_id, task_id, instance_id, action, triggered_at)
		VALUES (:id, :tenant_id, :task_id, :instance_id, :action, :triggered_at)`,
		map[string]interface{}{
			"id":           uuid.New().String(),
			"tenant_id":    tenantID,
			"task_id":      taskID,
			"instance_id":  instanceID,
			"action":       action,
			"triggered_at": time.Now(),
		})
	return err
}

// UpdateCheckerStatus persists the last-check metadata of the timeout checker.
//
// If the "task_timeout_checker_status" table does not yet exist this is a
// no-op; callers should tolerate the error.
func (r *Repository) UpdateCheckerStatus(ctx context.Context, lastCheckAt time.Time, totalChecked int64) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO task_timeout_checker_status (id, last_check_at, total_checked)
		VALUES ($1, $2, $3)
		ON CONFLICT (id) DO UPDATE SET
			last_check_at = $2,
			total_checked = task_timeout_checker_status.total_checked + $3`,
		"checker", lastCheckAt, totalChecked)
	return err
}

// hoursAfter returns the number of hours between start and now, rounded to 2 decimals.
func hoursAfter(start, now time.Time) float64 {
	secs := now.Sub(start).Seconds()
	return secs / 3600.0
}
