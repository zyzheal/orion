package repository

import (
	"context"
	"orion/feature-flag-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }
func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, f *models.FeatureFlag) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO feature_flags (id, tenant_id, name, key, description, enabled, rollout_pct, environment, rules) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, f.ID, f.TenantID, f.Name, f.Key, f.Description, f.Enabled, f.RolloutPct, f.Environment, f.Rules)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.FeatureFlag, error) {
	var items []models.FeatureFlag
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM feature_flags WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.FeatureFlag, error) {
	var f models.FeatureFlag
	err := r.db.GetContext(ctx, &f, `SELECT * FROM feature_flags WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &f, nil
}

func (r *Repository) Update(ctx context.Context, f *models.FeatureFlag) error {
	_, err := r.db.ExecContext(ctx, `UPDATE feature_flags SET name=$1, description=$2, enabled=$3, rollout_pct=$4, rules=$5, updated_at=NOW() WHERE id=$6 AND tenant_id=$7`, f.Name, f.Description, f.Enabled, f.RolloutPct, f.Rules, f.ID, f.TenantID)
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM feature_flags WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM feature_flags WHERE tenant_id=$1`, tenantID)
	return count, err
}

func (r *Repository) GetByKey(ctx context.Context, tenantID, key string) (*models.FeatureFlag, error) {
	var f models.FeatureFlag
	err := r.db.GetContext(ctx, &f, `SELECT * FROM feature_flags WHERE key=$1 AND tenant_id=$2`, key, tenantID)
	if err != nil {
		return nil, err
	}
	return &f, nil
}
