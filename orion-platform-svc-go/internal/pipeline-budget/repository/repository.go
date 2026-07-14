package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/pipeline-budget/models"

	"github.com/jmoiron/sqlx"
)

var errNotFound = errors.New("pipeline budget not found")

// Repository provides PostgreSQL-backed persistence for pipeline budgets.
//
// Tables:
//   pipeline_budgets       — one row per pipeline (JSONB for limits/alerts/period)
//   pipeline_budget_history — append-only history records
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new budget row for a pipeline.
func (r *Repository) Create(ctx context.Context, b *models.BudgetConfig) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO pipeline_budgets (
			id, pipeline_id, tenant_id, "type", period, limits, cost_limits, alerts,
			created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		b.ID, b.PipelineID, b.TenantID, string(b.Type),
		b.Period, b.Limits, b.CostLimits, b.Alerts,
		b.CreatedAt, b.UpdatedAt,
)
	return err
}

// GetByPipelineID retrieves the budget row for a single pipeline within a tenant.
func (r *Repository) GetByPipelineID(ctx context.Context, tenantID, pipelineID string) (*models.BudgetConfig, error) {
	var b models.BudgetConfig
	err := r.db.GetContext(ctx, &b,
		`SELECT * FROM pipeline_budgets WHERE pipeline_id=$1 AND tenant_id=$2`, pipelineID, tenantID)
	if err == sql.ErrNoRows {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// Upsert inserts a new budget or updates the existing one for a pipeline.
// Uses ON CONFLICT (pipeline_id, tenant_id) to guarantee one row per pipeline.
func (r *Repository) Upsert(ctx context.Context, b *models.BudgetConfig) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO pipeline_budgets (
			id, pipeline_id, tenant_id, "type", period, limits, cost_limits, alerts,
			created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		ON CONFLICT (pipeline_id, tenant_id) DO UPDATE SET
			"type"      = EXCLUDED."type",
			period      = EXCLUDED.period,
			limits      = EXCLUDED.limits,
			cost_limits = EXCLUDED.cost_limits,
			alerts      = EXCLUDED.alerts,
			updated_at  = EXCLUDED.updated_at
	`,
		b.ID, b.PipelineID, b.TenantID, string(b.Type),
		b.Period, b.Limits, b.CostLimits, b.Alerts,
		b.CreatedAt, b.UpdatedAt,
)
	return err
}

// Delete removes a budget row for a pipeline.
func (r *Repository) Delete(ctx context.Context, tenantID, pipelineID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM pipeline_budgets WHERE pipeline_id=$1 AND tenant_id=$2`, pipelineID, tenantID)
	return err
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

// AppendHistory inserts a new history record for a pipeline.
func (r *Repository) AppendHistory(ctx context.Context, h *models.BudgetHistoryRecord) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO pipeline_budget_history (
			id, pipeline_id, tenant_id, timestamp, action, details, actor
		) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		h.ID, h.PipelineID, h.TenantID, h.Timestamp, string(h.Action), h.Details, h.Actor,
)
	return err
}

// ListHistory retrieves paginated history records for a pipeline.
func (r *Repository) ListHistory(ctx context.Context, tenantID, pipelineID string, offset, limit int) ([]models.BudgetHistoryRecord, error) {
	var items []models.BudgetHistoryRecord
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM pipeline_budget_history
		 WHERE tenant_id=$1 AND pipeline_id=$2
		 ORDER BY timestamp DESC
		 OFFSET $3 LIMIT $4`,
		tenantID, pipelineID, offset, limit)
	return items, err
}

// CountHistory returns the total number of history records for a pipeline.
func (r *Repository) CountHistory(ctx context.Context, tenantID, pipelineID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM pipeline_budget_history
		 WHERE tenant_id=$1 AND pipeline_id=$2`, tenantID, pipelineID)
	return count, err
}

// ---------------------------------------------------------------------------
// Migration helper — creates tables if they do not exist.
// ---------------------------------------------------------------------------

// CreateTableIfNotExists runs the DDL for both tables in a transaction.
func (r *Repository) CreateTableIfNotExists(ctx context.Context) error {
	tx, err := r.db.Beginx()
	if err != nil {
		return fmt.Errorf("failed to begin tx: %w", err)
	}
	defer tx.Rollback() // safe no-op if committed

	stmts := []string{
		`CREATE TABLE IF NOT EXISTS pipeline_budgets (
			id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			pipeline_id TEXT    NOT NULL,
			tenant_id   TEXT    NOT NULL,
			"type"      TEXT    NOT NULL,
			period      JSONB   NOT NULL,
			limits      JSONB   NOT NULL,
			cost_limits JSONB,
			alerts      JSONB   NOT NULL DEFAULT '[]'::jsonb,
			created_at  BIGINT  NOT NULL,
			updated_at  BIGINT  NOT NULL,
			UNIQUE (pipeline_id, tenant_id)
		)`,
		`CREATE TABLE IF NOT EXISTS pipeline_budget_history (
			id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			pipeline_id TEXT    NOT NULL,
			tenant_id   TEXT    NOT NULL,
			timestamp   BIGINT  NOT NULL,
			action      TEXT    NOT NULL,
			details     JSONB   NOT NULL DEFAULT '{}'::jsonb,
			actor       TEXT    NOT NULL
		)`,
	}

	for i, stmt := range stmts {
		if _, err := tx.ExecContext(ctx, stmt); err != nil {
			return fmt.Errorf("statement %d failed: %w", i, err)
		}
	}

	return tx.Commit()
}
