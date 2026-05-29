package repository

import (
	"context"
	"fmt"
	"orion/scheduler-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

type SchedulerRepository struct {
	db *sqlx.DB
}

func NewSchedulerRepository(db *sqlx.DB) *SchedulerRepository {
	return &SchedulerRepository{db: db}
}

func (r *SchedulerRepository) CreateJob(ctx context.Context, j *models.Job) error {
	query := `
		INSERT INTO jobs (tenant_id, name, description, type, cron_expr, interval_sec, status, next_run_at, max_runs)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at
	`
	err := r.db.QueryRowContext(ctx, query,
		j.TenantID, j.Name, j.Description, j.Type, j.CronExpr,
		j.IntervalSec, j.Status, j.NextRunAt, j.MaxRuns,
	).Scan(&j.ID, &j.CreatedAt, &j.UpdatedAt)
	return err
}

func (r *SchedulerRepository) GetJobByID(ctx context.Context, tenantID, id string) (*models.Job, error) {
	var j models.Job
	query := `SELECT * FROM jobs WHERE tenant_id = $1 AND id = $2`
	err := r.db.GetContext(ctx, &j, query, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("job not found: %w", err)
	}
	return &j, nil
}

func (r *SchedulerRepository) ListJobs(ctx context.Context, tenantID string, offset, limit int) ([]models.Job, error) {
	var jobs []models.Job
	query := `SELECT * FROM jobs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`
	err := r.db.SelectContext(ctx, &jobs, query, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return jobs, nil
}

func (r *SchedulerRepository) UpdateJobStatus(ctx context.Context, id string, status models.JobStatus) error {
	query := `UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}

func (r *SchedulerRepository) UpdateJobRunInfo(ctx context.Context, id string) error {
	query := `UPDATE jobs SET last_run_at = NOW(), run_count = run_count + 1, updated_at = NOW() WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *SchedulerRepository) CreateJobRun(ctx context.Context, jr *models.JobRun) error {
	query := `
		INSERT INTO job_runs (job_id, status, started_at)
		VALUES ($1, $2, NOW())
		RETURNING id
	`
	err := r.db.QueryRowContext(ctx, query, jr.JobID, jr.Status).Scan(&jr.ID)
	return err
}

func (r *SchedulerRepository) UpdateJobRun(ctx context.Context, id, status string, errStr *string, durationMs int64) error {
	query := `UPDATE job_runs SET status = $1, error = $2, ended_at = NOW(), duration_ms = $3 WHERE id = $4`
	_, err := r.db.ExecContext(ctx, query, status, errStr, durationMs, id)
	return err
}

func (r *SchedulerRepository) GetJobRuns(ctx context.Context, jobID string, limit int) ([]models.JobRun, error) {
	var runs []models.JobRun
	query := `SELECT * FROM job_runs WHERE job_id = $1 ORDER BY started_at DESC LIMIT $2`
	err := r.db.SelectContext(ctx, &runs, query, jobID, limit)
	if err != nil {
		return nil, err
	}
	return runs, nil
}

func (r *SchedulerRepository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM jobs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *SchedulerRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM jobs WHERE tenant_id=$1`, tenantID)
	return count, err
}
