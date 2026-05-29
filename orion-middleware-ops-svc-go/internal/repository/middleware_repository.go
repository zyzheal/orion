package repository

import (
	"context"
	"orion/middleware-ops-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type InstanceRepository struct { db *sqlx.DB }
func NewInstanceRepository(db *sqlx.DB) *InstanceRepository { return &InstanceRepository{db: db} }

func (r *InstanceRepository) Create(ctx context.Context, d *models.MiddlewareInstance) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO middleware_instances (id, tenant_id, name, type, version, host, port, status, config, labels) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, d.ID, d.TenantID, d.Name, d.Type, d.Version, d.Host, d.Port, d.Status, d.Config, d.Labels)
	return err
}

func (r *InstanceRepository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.MiddlewareInstance, error) {
	var items []models.MiddlewareInstance
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM middleware_instances WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *InstanceRepository) GetByID(ctx context.Context, tenantID, id string) (*models.MiddlewareInstance, error) {
	var d models.MiddlewareInstance
	err := r.db.GetContext(ctx, &d, `SELECT * FROM middleware_instances WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &d, nil
}

func (r *InstanceRepository) Update(ctx context.Context, d *models.MiddlewareInstance) error {
	_, err := r.db.ExecContext(ctx, `UPDATE middleware_instances SET name=$1, type=$2, version=$3, host=$4, port=$5, status=$6, config=$7, labels=$8, updated_at=NOW() WHERE id=$9 AND tenant_id=$10`, d.Name, d.Type, d.Version, d.Host, d.Port, d.Status, d.Config, d.Labels, d.ID, d.TenantID)
	return err
}

func (r *InstanceRepository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM middleware_instances WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

type BackupRepository struct { db *sqlx.DB }
func NewBackupRepository(db *sqlx.DB) *BackupRepository { return &BackupRepository{db: db} }

func (r *BackupRepository) Create(ctx context.Context, d *models.BackupRecord) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO backup_records (id, tenant_id, instance_id, status, size_bytes, location, started_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`, d.ID, d.TenantID, d.InstanceID, d.Status, d.SizeBytes, d.Location, d.StartedAt)
	return err
}

func (r *BackupRepository) ListByInstance(ctx context.Context, tenantID, instanceID string) ([]models.BackupRecord, error) {
	var items []models.BackupRecord
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM backup_records WHERE tenant_id=$1 AND instance_id=$2 ORDER BY started_at DESC`, tenantID, instanceID)
	return items, err
}

func (r *InstanceRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM middleware_resources WHERE tenant_id=$1`, tenantID)
	return count, err
}
