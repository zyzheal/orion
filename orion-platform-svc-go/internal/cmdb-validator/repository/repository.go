package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"orion/platform-svc-go/internal/cmdb-validator/models"

	"github.com/jmoiron/sqlx"
)

var errNotFound = errors.New("validation rule not found")

// Repository provides PostgreSQL-backed persistence for CMDB validator rules and results.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ===========================================================================
// Rules CRUD
// ===========================================================================

// CreateRule inserts a new validation rule.
func (r *Repository) CreateRule(ctx context.Context, rule *models.CMDBValidationRule) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO cmdb_validation_rules (id, tenant_id, name, category, target_type,
			condition, error_message, severity, enabled, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		rule.ID, rule.TenantID, rule.Name, rule.Category, rule.TargetType,
		rule.Condition, rule.ErrorMessage, rule.Severity, rule.Enabled,
		rule.CreatedAt, rule.UpdatedAt,
	)
	return err
}

// GetRuleByID retrieves a rule by id and tenant_id.
func (r *Repository) GetRuleByID(ctx context.Context, tenantID, id string) (*models.CMDBValidationRule, error) {
	var rule models.CMDBValidationRule
	err := r.db.GetContext(ctx, &rule,
		`SELECT * FROM cmdb_validation_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err == sql.ErrNoRows {
		return nil, errNotFound
	}
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

// ListRules retrieves rules for a tenant with optional category filter.
func (r *Repository) ListRules(ctx context.Context, tenantID, category string, offset, limit int) ([]models.CMDBValidationRule, error) {
	var items []models.CMDBValidationRule

	query := "SELECT * FROM cmdb_validation_rules WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if category != "" {
		// Sanitize: only allow known category values
		knownCategories := []string{"format", "range", "reference", "enum", "custom", "relationship", "uniqueness"}
		if !sliceContains(knownCategories, category) {
			return nil, fmt.Errorf("unknown category: %s", category)
		}
		param := fmt.Sprintf("$%d", argIdx)
		query += " AND category=" + param
		args = append(args, category)
		argIdx++
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// CountRules returns the total number of rules for a tenant.
func (r *Repository) CountRules(ctx context.Context, tenantID, category string) (int, error) {
	query := "SELECT COUNT(*) FROM cmdb_validation_rules WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	if category != "" {
		query += " AND category=$2"
		args = append(args, category)
	}
	var count int
	err := r.db.GetContext(ctx, &count, query, args...)
	return count, err
}

// UpdateRule updates an existing rule.
func (r *Repository) UpdateRule(ctx context.Context, rule *models.CMDBValidationRule) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE cmdb_validation_rules
		SET name=$1, category=$2, target_type=$3, condition=$4,
			error_message=$5, severity=$6, enabled=$7, updated_at=NOW()
		WHERE id=$8 AND tenant_id=$9`,
		rule.Name, rule.Category, rule.TargetType, rule.Condition,
		rule.ErrorMessage, rule.Severity, rule.Enabled, rule.ID, rule.TenantID,
	)
	return err
}

// DeleteRule removes a rule by id and tenant_id.
func (r *Repository) DeleteRule(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM cmdb_validation_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// ===========================================================================
// Results CRUD
// ===========================================================================

// SaveResult inserts a validation result record.
func (r *Repository) SaveResult(ctx context.Context, result *models.CMDBValidationResult) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO cmdb_validation_results (id, tenant_id, rule_id, target_id,
			status, message, details, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		result.ID, result.TenantID, result.RuleID, result.TargetID,
		result.Status, result.Message, result.Details, result.CreatedAt,
	)
	return err
}

// GetValidationHistory retrieves recent validation results for a target.
func (r *Repository) GetValidationHistory(ctx context.Context, tenantID, targetID string, limit int) ([]models.CMDBValidationResult, error) {
	var items []models.CMDBValidationResult
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM cmdb_validation_results WHERE tenant_id=$1 AND target_id=$2
			ORDER BY created_at DESC LIMIT $3`,
		tenantID, targetID, limit)
	return items, err
}

// CountResultsByStatus counts results grouped by status for a target.
func (r *Repository) CountResultsByStatus(ctx context.Context, tenantID, targetID string) (map[string]int, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT status, COUNT(*) FROM cmdb_validation_results
			WHERE tenant_id=$1 AND target_id=$2 GROUP BY status`,
		tenantID, targetID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := map[string]int{}
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		counts[status] = count
	}
	return counts, nil
}

// ===========================================================================
// Helpers
// ===========================================================================

// CheckUniqueField checks if a field value already exists in CMDB records.
// This is used by the UniquenessValidator.
//
// The field is resolved against known CI columns (ci_id, name, ci_type, status,
// description, environment, tags) and against typed attribute values stored in
// cmdb_attribute_values. The check is scoped to tenant_id for multi-tenant
// isolation.
func (r *Repository) CheckUniqueField(ctx context.Context, tenantID, field, value string) (bool, error) {
	if tenantID == "" || field == "" || value == "" {
		return false, nil
	}

	// Whitelist of CI columns that can be checked for uniqueness.
	validCIFields := map[string]bool{
		"ci_id":    true,
		"name":     true,
		"ci_type":  true,
		"status":   true,
		"environment": true,
	}

	// 1. Check CI-level columns first.
	if validCIFields[field] {
		var exists bool
		ciSQL := fmt.Sprintf(
			"SELECT TRUE FROM cmdb_cis WHERE tenant_id=$1 AND %s=$2 LIMIT 1",
			sqlSafeIdentifier(field),
		)
		err := r.db.GetContext(ctx, &exists, ciSQL, tenantID, value)
		if errors.Is(err, sql.ErrNoRows) {
			// Not found in CI table — continue to check attributes below.
		} else if err != nil {
			return false, fmt.Errorf("check CI uniqueness for field %q: %w", field, err)
		} else if exists {
			return true, nil
		}
	}

	// 2. Check typed attribute values for this field (covers custom attributes).
	var existsAttr bool
	attrSQL := `
		SELECT TRUE
		FROM cmdb_attribute_values av
		JOIN cmdb_cis c ON av.ci_id = c.ci_id AND av.tenant_id = c.tenant_id
		WHERE av.tenant_id = $1 AND av.attribute_id = $2 AND av.value = $3
		LIMIT 1`
	err := r.db.GetContext(ctx, &existsAttr, attrSQL, tenantID, field, value)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("check attribute uniqueness for field %q: %w", field, err)
	}
	return true, nil
}

// sqlSafeIdentifier returns the identifier wrapped in double quotes when it is not
// already quoted, preventing keyword collisions.  It is intentionally minimal —
// callers must ensure the identifier is from a whitelist.
func sqlSafeIdentifier(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}

func sliceContains(slice []string, val string) bool {
	for _, s := range slice {
		if strings.EqualFold(s, val) {
			return true
		}
	}
	return false
}
