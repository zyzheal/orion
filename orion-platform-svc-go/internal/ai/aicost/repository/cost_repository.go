package repository

import (
	"context"
	"orion/platform-svc-go/internal/ai/aicost/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// CreateSavingsRecord inserts a savings history record.
func (r *Repository) CreateSavingsRecord(ctx context.Context, record *models.SavingsRecord) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO ai_cost_savings (id, tenant_id, amount, category, description, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		record.ID, record.TenantID, record.Amount, record.Category, record.Description, record.CreatedAt)
	return err
}

// ListSavingsHistory returns savings records for a tenant.
func (r *Repository) ListSavingsHistory(ctx context.Context, tenantID string) ([]models.SavingsRecord, error) {
	var records []models.SavingsRecord
	err := r.db.SelectContext(ctx, &records,
		`SELECT * FROM ai_cost_savings WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return records, err
}

// GetTotalSavings returns the total savings amount for a tenant.
func (r *Repository) GetTotalSavings(ctx context.Context, tenantID string) (float64, error) {
	var total float64
	err := r.db.GetContext(ctx, &total,
		`SELECT COALESCE(SUM(amount), 0) FROM ai_cost_savings WHERE tenant_id=$1`, tenantID)
	return total, err
}