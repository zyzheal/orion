package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/cron/cronparser"
	"orion/platform-svc-go/internal/cron/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// JobRepository provides CRUD access for JobDefinition and JobExecutionLog.
type JobRepository struct {
	db *sqlx.DB
}

func NewJobRepository(db *sqlx.DB) *JobRepository {
	return &JobRepository{db: db}
}

// --- JobDefinition CRUD ---

func (r *JobRepository) CreateJobDefinition(ctx context.Context, j *models.JobDefinition) error {
	j.ID = uuid.New().String()
	now := time.Now().UTC()
	j.CreatedAt = now
	j.UpdatedAt = now
	if j.MaxRetries == 0 {
		j.MaxRetries = 3
	}
	if j.TimeoutSec == 0 {
		j.TimeoutSec = 300
	}
	if j.Status == "" {
		j.Status = "enabled"
	}

	nextRun, err := nextRunTime(j.CronExpr)
	if err != nil {
		return fmt.Errorf("invalid cron expression: %w", err)
	}
	j.NextRunAt = &nextRun

	_, err = r.db.NamedExecContext(ctx,
		`INSERT INTO scheduler_job_definitions
		(id, tenant_id, name, cron_expr, job_type, config, status, last_run_at, next_run_at,
		 max_retries, timeout_sec, enabled, error, created_at, updated_at)
		VALUES
		(:id, :tenant_id, :name, :cron_expr, :job_type, :config, :status, :last_run_at, :next_run_at,
		 :max_retries, :timeout_sec, :enabled, :error, :created_at, :updated_at)`,
		j)
	return err
}

func (r *JobRepository) GetJobDefinition(ctx context.Context, tenantID, id string) (*models.JobDefinition, error) {
	var j models.JobDefinition
	err := r.db.GetContext(ctx, &j,
		`SELECT * FROM scheduler_job_definitions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &j, nil
}

func (r *JobRepository) ListJobDefinitions(ctx context.Context, tenantID string, limit, offset int) ([]models.JobDefinition, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.JobDefinition
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM scheduler_job_definitions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *JobRepository) UpdateJobDefinition(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.JobDefinition, error) {
	updates["updated_at"] = time.Now().UTC()

	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1
	for k, v := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, argIdx))
		args = append(args, v)
		argIdx++
	}
	args = append(args, id, tenantID)

	q := fmt.Sprintf("UPDATE scheduler_job_definitions SET %s WHERE id=$%d AND tenant_id=$%d",
		setClauses[0], argIdx, argIdx+1)
	for _, clause := range setClauses[1:] {
		_ = clause
	}

	_, err := r.db.ExecContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	return r.GetJobDefinition(ctx, tenantID, id)
}

func (r *JobRepository) DeleteJobDefinition(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM scheduler_job_definitions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *JobRepository) SetJobEnabled(ctx context.Context, tenantID, id string, enabled bool) error {
	status := "enabled"
	if !enabled {
		status = "disabled"
	}
	_, err := r.db.ExecContext(ctx,
		`UPDATE scheduler_job_definitions SET enabled=$1, status=$2, updated_at=NOW() WHERE id=$3 AND tenant_id=$4`,
		enabled, status, id, tenantID)
	return err
}

// UpdateJobStatus updates the runtime status fields (status, last_run_at, next_run_at, error).
func (r *JobRepository) UpdateJobStatus(ctx context.Context, tenantID, id string, status string, lastRun *time.Time, nextRun *time.Time, errMsg string) error {
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE scheduler_job_definitions SET status=:status, last_run_at=:last_run_at, next_run_at=:next_run_at, error=:error, updated_at=NOW()
		 WHERE id=:id AND tenant_id=:tenant_id`,
		map[string]interface{}{
			"id":          id,
			"tenant_id":   tenantID,
			"status":      status,
			"last_run_at": lastRun,
			"next_run_at": nextRun,
			"error":       errMsg,
		})
	return err
}

// ListAllEnabledDefinitions returns definitions across all tenants for scheduler startup.
func (r *JobRepository) ListAllEnabledDefinitions(ctx context.Context) ([]models.JobDefinition, error) {
	var items []models.JobDefinition
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM scheduler_job_definitions WHERE enabled = TRUE ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// --- JobExecutionLog CRUD ---

func (r *JobRepository) CreateJobExecutionLog(ctx context.Context, l *models.JobExecutionLog) error {
	l.ID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO scheduler_job_execution_logs
		(id, job_id, status, output, error, duration_ms, started_at, finished_at)
		VALUES
		(:id, :job_id, :status, :output, :error, :duration_ms, :started_at, :finished_at)`,
		l)
	return err
}

func (r *JobRepository) ListJobExecutionLogs(ctx context.Context, jobID string, limit int) ([]models.JobExecutionLog, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.JobExecutionLog
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM scheduler_job_execution_logs WHERE job_id=$1 ORDER BY started_at DESC LIMIT $2`,
		jobID, limit)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// GetJobDefinitionByJobIDInternal ignores tenant check -- used internally by the scheduler
// because scheduler_job_execution_logs already key on job_id (FK).
func (r *JobRepository) GetJobDefinitionByJobIDInternal(ctx context.Context, id string) (*models.JobDefinition, error) {
	var j models.JobDefinition
	err := r.db.GetContext(ctx, &j, `SELECT * FROM scheduler_job_definitions WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &j, nil
}

// IsValidCronExpression validates that the given expression can be parsed.
func (r *JobRepository) IsValidCronExpression(expr string) error {
	if expr == "" {
		return errors.New("cron expression is required")
	}
	_, err := nextRunTime(expr)
	return err
}

// --- helpers ---

// nextRunTime returns the next occurrence after now for a 5-field cron expression.
func nextRunTime(expr string) (time.Time, error) {
	parser := cronparser.NewParser()
	schedule, err := parser.Parse(expr)
	if err != nil {
		return time.Time{}, err
	}
	return schedule.Next(time.Now().UTC()), nil
}
