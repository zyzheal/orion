package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/compliance/models"

	"github.com/jmoiron/sqlx"
)

// ==================== CompliancePolicyRepository ====================

// CompliancePolicyRepository provides data access for compliance policies.
type CompliancePolicyRepository struct {
	db *sqlx.DB
}

// NewCompliancePolicyRepository creates a new CompliancePolicyRepository.
func NewCompliancePolicyRepository(db *sqlx.DB) *CompliancePolicyRepository {
	return &CompliancePolicyRepository{db: db}
}

// Create inserts a new compliance policy.
func (r *CompliancePolicyRepository) Create(ctx context.Context, policy *models.CompliancePolicy) error {
	query := `
		INSERT INTO compliance_policies
			(id, tenant_id, name, description, framework, category, severity, status, rule_type, expression, action, enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING created_at, updated_at
	`
	expr := "[]"
	if len(policy.Expression) > 0 {
		b, err := json.Marshal(policy.Expression)
		if err != nil {
			return fmt.Errorf("failed to marshal expression: %w", err)
		}
		expr = string(b)
	}

	return r.db.QueryRowContext(ctx, query,
		policy.ID,
		policy.TenantID,
		policy.Name,
		policy.Description,
		policy.Framework,
		policy.Category,
		policy.Severity,
		policy.Status,
		policy.RuleType,
		expr,
		policy.Action,
		policy.Enabled,
	).Scan(&policy.CreatedAt, &policy.UpdatedAt)
}

// FindByID retrieves a compliance policy by its ID.
func (r *CompliancePolicyRepository) FindByID(ctx context.Context, id string) (*models.CompliancePolicy, error) {
	var policy models.CompliancePolicy
	query := `SELECT * FROM compliance_policies WHERE id = $1`
	err := r.db.GetContext(ctx, &policy, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find policy: %w", err)
	}
	return &policy, nil
}

// FindByTenant retrieves all policies for a given tenant with optional filters and pagination.
func (r *CompliancePolicyRepository) FindByTenant(ctx context.Context, tenantID, framework, category string, offset, limit int) ([]models.CompliancePolicy, error) {
	var policies []models.CompliancePolicy
	query := `SELECT * FROM compliance_policies WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	paramIdx := 2

	if framework != "" {
		query += fmt.Sprintf(" AND framework = $%d", paramIdx)
		args = append(args, framework)
		paramIdx++
	}
	if category != "" {
		query += fmt.Sprintf(" AND category = $%d", paramIdx)
		args = append(args, category)
		paramIdx++
	}
	query += fmt.Sprintf(` ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, paramIdx, paramIdx+1)
	args = append(args, limit, offset)

	err := r.db.SelectContext(ctx, &policies, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to find policies by tenant: %w", err)
	}
	return policies, nil
}

// Update updates specific fields of a compliance policy.
func (r *CompliancePolicyRepository) Update(ctx context.Context, id string, input *models.UpdatePolicyInput) (*models.CompliancePolicy, error) {
	existing, err := r.FindByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to find policy for update: %w", err)
	}
	if existing == nil {
		return nil, nil
	}

	setClauses := []string{}
	args := []interface{}{}
	paramIdx := 1

	if input.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", paramIdx))
		args = append(args, *input.Name)
		paramIdx++
	}
	if input.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", paramIdx))
		args = append(args, *input.Description)
		paramIdx++
	}
	if input.Framework != nil {
		setClauses = append(setClauses, fmt.Sprintf("framework = $%d", paramIdx))
		args = append(args, *input.Framework)
		paramIdx++
	}
	if input.Category != nil {
		setClauses = append(setClauses, fmt.Sprintf("category = $%d", paramIdx))
		args = append(args, *input.Category)
		paramIdx++
	}
	if input.Severity != nil {
		setClauses = append(setClauses, fmt.Sprintf("severity = $%d", paramIdx))
		args = append(args, *input.Severity)
		paramIdx++
	}
	if input.Status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", paramIdx))
		args = append(args, *input.Status)
		paramIdx++
	}
	if input.RuleType != nil {
		setClauses = append(setClauses, fmt.Sprintf("rule_type = $%d", paramIdx))
		args = append(args, *input.RuleType)
		paramIdx++
	}
	if input.Expression != nil {
		expr, err := json.Marshal(input.Expression)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal expression: %w", err)
		}
		setClauses = append(setClauses, fmt.Sprintf("expression = $%d::jsonb", paramIdx))
		args = append(args, expr)
		paramIdx++
	}
	if input.Action != nil {
		setClauses = append(setClauses, fmt.Sprintf("action = $%d", paramIdx))
		args = append(args, *input.Action)
		paramIdx++
	}
	if input.Enabled != nil {
		setClauses = append(setClauses, fmt.Sprintf("enabled = $%d", paramIdx))
		args = append(args, *input.Enabled)
		paramIdx++
	}

	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", paramIdx))
	args = append(args, time.Now())
	paramIdx++
	args = append(args, id)

	query := fmt.Sprintf(
		"UPDATE compliance_policies SET %s WHERE id = $%d RETURNING *",
		joinSetClauses(setClauses), paramIdx,
	)

	var policy models.CompliancePolicy
	err = r.db.GetContext(ctx, &policy, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to update policy: %w", err)
	}
	return &policy, nil
}

// Delete removes a compliance policy by ID.
func (r *CompliancePolicyRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM compliance_policies WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete policy: %w", err)
	}
	return nil
}
