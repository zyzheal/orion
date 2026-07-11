package repository

import (
	"context"
	"fmt"

	"orion/approval-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

// FlowConfigRepository handles persistence for approval flow configurations.
type FlowConfigRepository struct {
	db *sqlx.DB
}

func NewFlowConfigRepository(db *sqlx.DB) *FlowConfigRepository {
	return &FlowConfigRepository{db: db}
}

// Create inserts a new flow configuration.
func (r *FlowConfigRepository) Create(ctx context.Context, c *models.FlowConfig) error {
	query := `
		INSERT INTO approval_flow_configs
			(tenant_id, flow_id, name, description, enabled, capability_ids, environments,
			 min_risk_level, max_risk_level, priority, nodes, version)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at, updated_at
	`
	err := r.db.QueryRowContext(ctx, query,
		c.TenantID, c.FlowID, c.Name, c.Description, c.Enabled,
		c.CapabilityIDs, c.Environments,
		c.MinRiskLevel, c.MaxRiskLevel, c.Priority, c.Nodes, c.Version,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create flow config: %w", err)
	}
	return nil
}

// GetByID returns a flow config by tenant and ID.
func (r *FlowConfigRepository) GetByID(ctx context.Context, tenantID, id string) (*models.FlowConfig, error) {
	var c models.FlowConfig
	err := r.db.GetContext(ctx, &c,
		`SELECT * FROM approval_flow_configs WHERE tenant_id = $1 AND id = $2`, tenantID, id)
	if err != nil {
		return nil, fmt.Errorf("get flow config: %w", err)
	}
	return &c, nil
}

// ListByTenant returns all flow configs for a tenant.
func (r *FlowConfigRepository) ListByTenant(ctx context.Context, tenantID string) ([]models.FlowConfig, error) {
	var configs []models.FlowConfig
	err := r.db.SelectContext(ctx, &configs,
		`SELECT * FROM approval_flow_configs WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list flow configs: %w", err)
	}
	return configs, nil
}

// Update updates a flow configuration.
func (r *FlowConfigRepository) Update(ctx context.Context, c *models.FlowConfig) error {
	query := `
		UPDATE approval_flow_configs
		SET name = $1, description = $2, enabled = $3, nodes = $4, priority = $5,
			version = version + 1, updated_at = NOW()
		WHERE id = $6 AND tenant_id = $7
	`
	_, err := r.db.ExecContext(ctx, query,
		c.Name, c.Description, c.Enabled, c.Nodes, c.Priority, c.ID, c.TenantID)
	if err != nil {
		return fmt.Errorf("update flow config: %w", err)
	}
	return nil
}

// Delete removes a flow config.
func (r *FlowConfigRepository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM approval_flow_configs WHERE tenant_id = $1 AND id = $2`, tenantID, id)
	return err
}

// FindMatching finds the best matching flow config for the given criteria.
func (r *FlowConfigRepository) FindMatching(ctx context.Context, tenantID, capabilityID, environment string, riskLevel int) (*models.FlowConfig, error) {
	var c models.FlowConfig
	err := r.db.GetContext(ctx, &c, `
		SELECT * FROM approval_flow_configs
		WHERE tenant_id = $1 AND enabled = true
		  AND (capability_ids ? $2 OR capability_ids @> '["*"]'::jsonb)
		  AND (environments ? $3 OR environments @> '["*"]'::jsonb)
		  AND ($4 >= min_risk_level AND $4 <= max_risk_level)
		ORDER BY priority DESC, version DESC
		LIMIT 1
	`, tenantID, capabilityID, environment, riskLevel)
	if err != nil {
		return nil, err // Returns sql.ErrNoRows if no match
	}
	return &c, nil
}
