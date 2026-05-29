package repository

import (
	"context"
	"orion/llm-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

type Repository struct { db *sqlx.DB }
func NewRepository(db *sqlx.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Create(ctx context.Context, d *models.LLMModel) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO llm_models (id, tenant_id, name, provider, model_name, token_count, cost_usd, latency_ms) VALUES ($1,$2,$3, $4, $5, $6, $7, $8)`, d.ID, d.TenantID, d.Name)
	return err
}

func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.LLMModel, error) {
	var items []models.LLMModel
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM llm_models WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.LLMModel, error) {
	var d models.LLMModel
	err := r.db.GetContext(ctx, &d, `SELECT * FROM llm_models WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil { return nil, err }
	return &d, nil
}
