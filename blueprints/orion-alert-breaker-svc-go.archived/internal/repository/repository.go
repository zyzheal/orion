package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion-alert-breaker-svc-go/internal/models"
)

// AlertBreakerRepository handles alert breaker rule persistence.
type AlertBreakerRepository struct {
	db *sqlx.DB
}

// NewAlertBreakerRepository creates a new repository.
func NewAlertBreakerRepository(db *sqlx.DB) *AlertBreakerRepository {
	return &AlertBreakerRepository{db: db}
}

// Create inserts a new alert breaker rule.
func (r *AlertBreakerRepository) Create(ctx context.Context, tenantID string, rule *models.AlertBreakerRule) error {
	rule.ID = uuid.New().String()
	rule.TenantID = tenantID
	now := time.Now().UTC()
	rule.CreatedAt = now
	rule.UpdatedAt = now

	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO alert_breaker_rules (id, tenant_id, name, description, matchers, actions, is_active, created_by, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :description, :matchers, :actions, :is_active, :created_by, :created_at, :updated_at)`,
		rule)
	return fmt.Errorf("failed to create alert breaker rule: %w", err)
}

// GetByID returns a rule by ID scoped to tenant.
func (r *AlertBreakerRepository) GetByID(ctx context.Context, tenantID, id string) (*models.AlertBreakerRule, error) {
	var rule models.AlertBreakerRule
	err := r.db.GetContext(ctx, &rule,
		`SELECT * FROM alert_breaker_rules WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("rule not found: %w", err)
	}
	return &rule, nil
}

// ListByTenant returns all rules for a tenant.
func (r *AlertBreakerRepository) ListByTenant(ctx context.Context, tenantID string) ([]models.AlertBreakerRule, error) {
	var rules []models.AlertBreakerRule
	err := r.db.SelectContext(ctx, &rules,
		`SELECT * FROM alert_breaker_rules WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to list rules: %w", err)
	}
	return rules, nil
}

// Update updates an existing rule.
func (r *AlertBreakerRepository) Update(ctx context.Context, tenantID, id string, rule *models.AlertBreakerRule) error {
	now := time.Now().UTC()
	rule.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx, `
		UPDATE alert_breaker_rules SET name = :name, description = :description,
			matchers = :matchers, actions = :actions, is_active = :is_active, updated_at = :updated_at
		WHERE id = :id AND tenant_id = :tenant_id`, rule)
	return err
}

// Delete removes a rule.
func (r *AlertBreakerRepository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM alert_breaker_rules WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	return err
}
