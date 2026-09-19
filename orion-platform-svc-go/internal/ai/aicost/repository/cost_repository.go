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

// GetTotalSpend returns the tenant's recorded spend, summed from the
// ai_cost_records rows that the ai/cost module writes on every request.
//
// It used to sum ai_cost_savings -- the savings ledger, not spend -- and then
// replaced both a query error and a genuine zero with a hardcoded 5000.00, so
// every tenant reported the same spend whether the table was empty, the
// connection was down, or the tenant had simply used no model yet. COALESCE
// makes the no-rows case a real zero: a tenant with no records has spent
// nothing, and that is information rather than a value to hide.
func (r *Repository) GetTotalSpend(ctx context.Context, tenantID string) (float64, error) {
	var total float64
	err := r.db.GetContext(ctx, &total,
		`SELECT COALESCE(SUM(cost), 0) FROM ai_cost_records WHERE tenant_id = $1`, tenantID)
	return total, err
}

// ModelSpend is one model's share of a tenant's recorded spend. ModelID is
// coalesced to "" because ai_cost_records.model_id is nullable, and records
// without one are still spend that should not vanish from the analysis.
type ModelSpend struct {
	ModelID  string  `db:"model_id"`
	Spend    float64 `db:"spend"`
	Requests int64   `db:"requests"`
}

// ListSpendByModel returns the tenant's spend grouped by model, largest first.
// The window is the last 30 days because the only field the callers expose is
// EstimatedMonthlySavings; the all-time total is GetTotalSpend's job, and the
// two must not share a window.
func (r *Repository) ListSpendByModel(ctx context.Context, tenantID string) ([]ModelSpend, error) {
	var rows []ModelSpend
	err := r.db.SelectContext(ctx, &rows,
		`SELECT COALESCE(model_id, '') AS model_id,
		        COALESCE(SUM(cost), 0) AS spend,
		        COUNT(*) AS requests
		 FROM ai_cost_records
		 WHERE tenant_id = $1
		   AND created_at >= NOW() - INTERVAL '30 days'
		 GROUP BY 1
		 ORDER BY spend DESC, model_id`, tenantID)
	return rows, err
}
