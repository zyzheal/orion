package repository

import (
	"context"
	"orion/cron-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }
func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, j *models.CronJob) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO cron_jobs (id, tenant_id, name, schedule, command, enabled) VALUES ($1,$2,$3,$4,$5,$6)`, j.ID, j.TenantID, j.Name, j.Schedule, j.Command, j.Enabled)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.CronJob, error) {
	var items []models.CronJob
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM cron_jobs WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.CronJob, error) {
	var j models.CronJob
	err := r.db.GetContext(ctx, &j, `SELECT * FROM cron_jobs WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }; return &j, nil
}
