package repository

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/cron/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{
		db: db,
	}
}

func (r *Repository) Create(ctx context.Context, m *models.CronJob) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	if m.Enabled {
		m.Status = "active"
	} else {
		m.Status = "disabled"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO cron_jobs (id, tenant_id, name, schedule, task, description, enabled, status, created_at, updated_at) VALUES (:id, :tenant_id, :name, :schedule, :task, :description, :enabled, :status, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.CronJob, error) {
	var m models.CronJob
	err := r.db.GetContext(ctx, &m, `SELECT * FROM cron_jobs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]models.CronJob, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.CronJob
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM cron_jobs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	return r.UpdatePartial(ctx, tenantID, id, updates)
}

func (r *Repository) UpdatePartial(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
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

	q := fmt.Sprintf("UPDATE cron_jobs SET %s WHERE id=$%d AND tenant_id=$%d",
		setClauses[0], argIdx, argIdx+1)
	for _, clause := range setClauses[1:] {
		q += ", " + clause
	}

	_, err := r.db.ExecContext(ctx, q, args...)
	if err != nil {
		return fmt.Errorf("failed to partial update: %w", err)
	}
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM cron_jobs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) Enable(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE cron_jobs SET enabled = true, status = 'active', updated_at = NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) Disable(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE cron_jobs SET enabled = false, status = 'disabled', updated_at = NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) CreateExecution(ctx context.Context, m *models.CronJobExecution) error {
	m.ExecutionID = uuid.New().String()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO cron_job_executions (execution_id, job_id, tenant_id, status, output, started_at) VALUES (:execution_id, :job_id, :tenant_id, :status, :output, :started_at)`, m)
	return err
}

func (r *Repository) ListExecutions(ctx context.Context, tenantID, jobID string, limit, offset int) ([]models.CronJobExecution, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.CronJobExecution
	if jobID != "" {
		err := r.db.SelectContext(ctx, &items,
			`SELECT * FROM cron_job_executions WHERE tenant_id=$1 AND job_id=$2 ORDER BY started_at DESC LIMIT $3 OFFSET $4`,
			tenantID, jobID, limit, offset)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM cron_job_executions WHERE tenant_id=$1 ORDER BY started_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset)
	return items, err
}

func (r *Repository) GetExecutionByID(ctx context.Context, tenantID, executionID string) (*models.CronJobExecution, error) {
	var m models.CronJobExecution
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM cron_job_executions WHERE execution_id=$1 AND tenant_id=$2`, executionID, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}
