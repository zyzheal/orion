package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/data-masking/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository provides PostgreSQL-backed CRUD operations for masking rules.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new PostgreSQL Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new masking rule.
func (r *Repository) Create(ctx context.Context, rule *models.MaskingRule) error {
	if rule.ID == "" {
		rule.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	rule.CreatedAt = now
	rule.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO masking_rules (id, tenant_id, name, description, strategy, field_pattern, resource_type, replacement, classification_level, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :description, :strategy, :field_pattern, :resource_type, :replacement, :classification_level, :enabled, :created_at, :updated_at)`,
		rule)
	return err
}

// GetByID retrieves a masking rule by ID and tenant ID.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.MaskingRule, error) {
	var rule models.MaskingRule
	err := r.db.GetContext(ctx, &rule, `SELECT * FROM masking_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &rule, err
}

// List returns all masking rules for a tenant.
func (r *Repository) List(ctx context.Context, tenantID string) ([]models.MaskingRule, error) {
	var result []models.MaskingRule
	err := r.db.SelectContext(ctx, &result, `SELECT * FROM masking_rules WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	if result == nil {
		result = []models.MaskingRule{}
	}
	return result, nil
}

// ListByResourceType returns all enabled rules for a tenant filtered by resource type.
func (r *Repository) ListByResourceType(ctx context.Context, tenantID, resourceType string) ([]models.MaskingRule, error) {
	var result []models.MaskingRule
	err := r.db.SelectContext(ctx, &result, `SELECT * FROM masking_rules WHERE tenant_id=$1 AND resource_type=$2 AND enabled=$3 ORDER BY created_at DESC`, tenantID, resourceType, true)
	if err != nil {
		return nil, err
	}
	if result == nil {
		result = []models.MaskingRule{}
	}
	return result, nil
}

// Update applies partial updates to a masking rule.
func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.MaskingRule, error) {
	sets, args := []string{}, []interface{}{}
	i := 1

	if v, ok := updates["name"]; ok {
		sets = append(sets, fmt.Sprintf("name=$%d", i))
		args = append(args, v.(string))
		i++
	}
	if v, ok := updates["description"]; ok {
		sets = append(sets, fmt.Sprintf("description=$%d", i))
		args = append(args, v.(string))
		i++
	}
	if v, ok := updates["strategy"]; ok {
		sets = append(sets, fmt.Sprintf("strategy=$%d", i))
		args = append(args, v.(string))
		i++
	}
	if v, ok := updates["fieldPattern"]; ok {
		sets = append(sets, fmt.Sprintf("field_pattern=$%d", i))
		args = append(args, v.(string))
		i++
	}
	if v, ok := updates["resourceType"]; ok {
		sets = append(sets, fmt.Sprintf("resource_type=$%d", i))
		args = append(args, v.(string))
		i++
	}
	if v, ok := updates["replacement"]; ok {
		sets = append(sets, fmt.Sprintf("replacement=$%d", i))
		args = append(args, v.(string))
		i++
	}
	if v, ok := updates["classificationLevel"]; ok {
		sets = append(sets, fmt.Sprintf("classification_level=$%d", i))
		args = append(args, v.(string))
		i++
	}
	if v, ok := updates["enabled"]; ok {
		sets = append(sets, fmt.Sprintf("enabled=$%d", i))
		args = append(args, v.(bool))
		i++
	}

	if len(sets) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}

	args = append(args, time.Now().UTC(), id, tenantID)
	query := "UPDATE masking_rules SET " + sets[0]
	for _, s := range sets[1:] {
		query += ", " + s
	}
	query += fmt.Sprintf(", updated_at=$%d WHERE id=$%d AND tenant_id=$%d RETURNING *", i, i+1, i+2)

	var rule models.MaskingRule
	err := r.db.GetContext(ctx, &rule, query, args...)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &rule, err
}

// Delete removes a masking rule by ID and tenant ID.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	res, err := r.db.ExecContext(ctx, `DELETE FROM masking_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := res.RowsAffected()
	return rows > 0, nil
}

// Mask applies a set of masking rules to the provided data map.
// Returns the masked data and a list of field names that were masked.
func (r *Repository) Mask(ctx context.Context, data map[string]interface{}, rules []models.MaskingRule) (map[string]interface{}, []string, error) {
	maskedData := make(map[string]interface{}, len(data))
	for k, v := range data {
		maskedData[k] = v
	}
	var maskedFields []string
	for _, rule := range rules {
		if rule.FieldPattern == "" {
			continue
		}
		if val, exists := maskedData[rule.FieldPattern]; exists {
			if strVal, ok := val.(string); ok {
				maskedData[rule.FieldPattern] = strVal
				maskedFields = append(maskedFields, rule.FieldPattern)
			}
		}
	}
	return maskedData, maskedFields, nil
}