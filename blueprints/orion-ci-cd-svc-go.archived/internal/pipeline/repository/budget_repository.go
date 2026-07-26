package repository

import (
	"context"
	"fmt"

	"github.com/jmoiron/sqlx"
	"github.com/google/uuid"

	"orion/ci-cd-svc-go/internal/pipeline/models"
)

// BudgetRepository handles database operations for pipeline budgets.
type BudgetRepository struct {
	db *sqlx.DB
}

func NewBudgetRepository(db *sqlx.DB) *BudgetRepository {
	return &BudgetRepository{db: db}
}

// Create inserts a new budget record.
func (r *BudgetRepository) Create(ctx context.Context, b *models.PipelineBudget) error {
	if b.ID == "" {
		b.ID = uuid.New().String()
	}
	query := `
		INSERT INTO pipeline_budgets (id, tenant_id, pipeline_id, budget_limit, current_spend, currency, period, description, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING created_at, updated_at
	`
	err := r.db.QueryRowContext(ctx, query,
		b.ID, b.TenantID, b.PipelineID, b.BudgetLimit, b.CurrentSpend, b.Currency, b.Period, b.Description, b.CreatedBy,
	).Scan(&b.CreatedAt, &b.UpdatedAt)
	return err
}

// GetByTenant returns the budget for a tenant (first matching record).
func (r *BudgetRepository) GetByTenant(ctx context.Context, tenantID string) (*models.PipelineBudget, error) {
	var b models.PipelineBudget
	query := `SELECT id, tenant_id, pipeline_id, budget_limit, current_spend, currency, period, description, created_by, created_at, updated_at
		FROM pipeline_budgets WHERE tenant_id = $1 AND pipeline_id IS NULL ORDER BY created_at DESC LIMIT 1`
	err := r.db.GetContext(ctx, &b, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("budget not found: %w", err)
	}
	return &b, nil
}

// GetByPipelineID returns the budget for a specific pipeline.
func (r *BudgetRepository) GetByPipelineID(ctx context.Context, tenantID, pipelineID string) (*models.PipelineBudget, error) {
	var b models.PipelineBudget
	query := `SELECT id, tenant_id, pipeline_id, budget_limit, current_spend, currency, period, description, created_by, created_at, updated_at
		FROM pipeline_budgets WHERE tenant_id = $1 AND (pipeline_id = $2 OR pipeline_id IS NULL) ORDER BY pipeline_id DESC NULLS LAST LIMIT 1`
	err := r.db.GetContext(ctx, &b, query, tenantID, pipelineID)
	if err != nil {
		return nil, fmt.Errorf("budget not found: %w", err)
	}
	return &b, nil
}

// List returns all budgets for a tenant.
func (r *BudgetRepository) List(ctx context.Context, tenantID string) ([]models.PipelineBudget, error) {
	var budgets []models.PipelineBudget
	query := `SELECT id, tenant_id, pipeline_id, budget_limit, current_spend, currency, period, description, created_by, created_at, updated_at
		FROM pipeline_budgets WHERE tenant_id = $1 ORDER BY created_at DESC`
	err := r.db.SelectContext(ctx, &budgets, query, tenantID)
	if err != nil {
		return nil, err
	}
	return budgets, nil
}

// Update updates a budget record.
func (r *BudgetRepository) Update(ctx context.Context, b *models.PipelineBudget) error {
	query := `
		UPDATE pipeline_budgets SET budget_limit = $1, current_spend = $2, currency = $3, period = $4, description = $5, updated_at = NOW()
		WHERE id = $6 AND tenant_id = $7
	`
	_, err := r.db.ExecContext(ctx, query, b.BudgetLimit, b.CurrentSpend, b.Currency, b.Period, b.Description, b.ID, b.TenantID)
	return err
}

// Delete deletes a budget record.
func (r *BudgetRepository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM pipeline_budgets WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}

// GetEffectiveBudget returns the most applicable budget for a given pipeline.
// It first checks for a pipeline-specific budget, then falls back to tenant-level.
func (r *BudgetRepository) GetEffectiveBudget(ctx context.Context, tenantID, pipelineID string) (*models.PipelineBudget, error) {
	// Try pipeline-specific first
	b, err := r.GetByPipelineID(ctx, tenantID, pipelineID)
	if err == nil {
		return b, nil
	}
	// Fall back to tenant-level
	return r.GetByTenant(ctx, tenantID)
}