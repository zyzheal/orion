package repository

import (
	"context"
	"fmt"

	"orion/platform-svc-go/internal/ci-cd/pipeline/models"

	"github.com/jmoiron/sqlx"
)

type TaskRepository struct {
	db *sqlx.DB
}

func NewTaskRepository(db *sqlx.DB) *TaskRepository {
	return &TaskRepository{db: db}
}

func (r *TaskRepository) Create(ctx context.Context, task *models.Task) error {
	query := `
		INSERT INTO tasks (stage_id, name, type, status, config, sequence)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`
	err := r.db.QueryRowContext(ctx, query,
		task.StageID, task.Name, task.Type, task.Status, task.Config, task.Sequence,
	).Scan(&task.ID, &task.CreatedAt)
	return err
}

func (r *TaskRepository) GetByID(ctx context.Context, id string) (*models.Task, error) {
	var task models.Task
	query := `SELECT id, stage_id, name, type, status, config, sequence, started_at, completed_at, exit_code, logs, created_at FROM tasks WHERE id = $1`
	err := r.db.GetContext(ctx, &task, query, id)
	if err != nil {
		return nil, fmt.Errorf("task not found: %w", err)
	}
	return &task, nil
}

func (r *TaskRepository) GetByStageID(ctx context.Context, stageID string) ([]models.Task, error) {
	var tasks []models.Task
	query := `SELECT id, stage_id, name, type, status, config, sequence, started_at, completed_at, exit_code, logs, created_at FROM tasks WHERE stage_id = $1 ORDER BY sequence, created_at`
	err := r.db.SelectContext(ctx, &tasks, query, stageID)
	if err != nil {
		return nil, fmt.Errorf("tasks not found: %w", err)
	}
	return tasks, nil
}

// MarkRunning marks a task as running.
func (r *TaskRepository) MarkRunning(ctx context.Context, id string) error {
	query := `UPDATE tasks SET status = 'running', started_at = NOW() WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// MarkCompleted marks a task as completed with the given status and exit code.
func (r *TaskRepository) MarkCompleted(ctx context.Context, id string, status models.TaskStatus, exitCode int) error {
	query := `UPDATE tasks SET status = $1, exit_code = $2, completed_at = NOW() WHERE id = $3`
	_, err := r.db.ExecContext(ctx, query, status, exitCode, id)
	return err
}

// AppendLog appends text to a task's log field.
func (r *TaskRepository) AppendLog(ctx context.Context, id, logLine string) error {
	query := `UPDATE tasks SET logs = COALESCE(logs, '') || $1 || E'\n' WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, logLine, id)
	return err
}

// SetLog overwrites the task's log field.
func (r *TaskRepository) SetLog(ctx context.Context, id, logs string) error {
	query := `UPDATE tasks SET logs = $1 WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, logs, id)
	return err
}

// GetByRunID returns all tasks for all stages in a run.
func (r *TaskRepository) GetByRunID(ctx context.Context, runID string) ([]models.Task, error) {
	var tasks []models.Task
	query := `SELECT t.id, t.stage_id, t.name, t.type, t.status, t.config, t.sequence, t.started_at, t.completed_at, t.exit_code, t.logs, t.created_at
		FROM tasks t JOIN stages s ON t.stage_id = s.id
		WHERE s.run_id = $1 ORDER BY t.sequence, t.created_at`
	err := r.db.SelectContext(ctx, &tasks, query, runID)
	return tasks, err
}

// CountByStage returns the count of tasks in a stage.
func (r *TaskRepository) CountByStage(ctx context.Context, stageID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM tasks WHERE stage_id=$1`, stageID)
	return count, err
}
