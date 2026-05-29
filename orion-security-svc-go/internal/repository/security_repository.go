package repository

import (
	"context"
	"orion/security-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }
func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, d *models.SecurityScan) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO findings (id, tenant_id, name, finding_type, severity, status, description, cve_id) VALUES ($1,$2,$3, $4, $5, $6, $7, $8)`, d.ID, d.TenantID, d.Name)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.SecurityScan, error) {
	var items []models.SecurityScan
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM security_scans WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.SecurityScan, error) {
	var d models.SecurityScan
	err := r.db.GetContext(ctx, &d, `SELECT * FROM security_scans WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &d, nil
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM findings WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM findings WHERE tenant_id=$1`, tenantID)
	return count, err
}
