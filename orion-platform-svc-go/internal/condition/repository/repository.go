package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/condition/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository provides data access for condition groups and expressions.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// rowToGroup converts a database row to a ConditionGroup.
func (r *Repository) rowToGroup(row map[string]interface{}) *models.ConditionGroup {
	return &models.ConditionGroup{
		ID:          toString(row["id"]),
		TenantID:    toString(row["tenant_id"]),
		Name:        toString(row["name"]),
		Type:        toString(row["type"]),
		Children:    toString(row["children"]),
		Enabled:     toBool(row["enabled"]),
		Description: toString(row["description"]),
		CreatedAt:   toTime(row["created_at"]),
		UpdatedAt:   toTime(row["updated_at"]),
	}
}

// CreateGroup inserts a new condition group.
func (r *Repository) CreateGroup(ctx context.Context, tenantID, name, groupType string, children []map[string]interface{}, enabled *bool, description string) (*models.ConditionGroup, error) {
	id := uuid.New().String()
	childrenJSON, _ := json.Marshal(children)
	if childrenJSON == nil {
		childrenJSON = []byte("[]")
	}
	now := time.Now().UTC()
	e := true
	if enabled != nil {
		e = *enabled
	}

	query := `INSERT INTO condition_groups (id, tenant_id, name, type, children, enabled, description, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :type, :children, :enabled, :description, :created_at, :updated_at)`

	params := map[string]interface{}{
		"id":          id,
		"tenant_id":   tenantID,
		"name":        name,
		"type":        groupType,
		"children":    string(childrenJSON),
		"enabled":     e,
		"description": description,
		"created_at":  now,
		"updated_at":  now,
	}
	_, err := r.db.NamedExecContext(ctx, query, params)
	if err != nil {
		return nil, err
	}

	return &models.ConditionGroup{
		ID:          id,
		TenantID:    tenantID,
		Name:        name,
		Type:        groupType,
		Children:    string(childrenJSON),
		Enabled:     e,
		Description: description,
		CreatedAt:   now,
		UpdatedAt:   now,
	}, nil
}

// GetGroup retrieves a group by ID and tenant.
func (r *Repository) GetGroup(ctx context.Context, tenantID, id string) (*models.ConditionGroup, error) {
	var row map[string]interface{}
	err := r.db.GetContext(ctx, &row,
		`SELECT * FROM condition_groups WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.rowToGroup(row), nil
}

// ListGroups returns groups for a tenant with optional type filter.
func (r *Repository) ListGroups(ctx context.Context, tenantID string, groupType string) ([]models.ConditionGroup, error) {
	query := `SELECT * FROM condition_groups WHERE tenant_id = $1`
	args := []interface{}{tenantID}

	if groupType != "" {
		query += ` AND type = $2`
		args = append(args, groupType)
	}

	query += ` ORDER BY created_at DESC`

	var rows []map[string]interface{}
	err := r.db.SelectContext(ctx, &rows, query, args...)
	if err != nil {
		return nil, err
	}

	groups := make([]models.ConditionGroup, 0, len(rows))
	for _, row := range rows {
		groups = append(groups, *r.rowToGroup(row))
	}
	return groups, nil
}

// UpdateGroup applies partial updates to a group.
func (r *Repository) UpdateGroup(ctx context.Context, tenantID, id string, name, groupType *string, enabled *bool, description *string) (*models.ConditionGroup, error) {
	updates := []string{}
	args := []interface{}{}
	idx := 1

	if name != nil {
		updates = append(updates, fmt.Sprintf("name = $%d", idx))
		args = append(args, *name)
		idx++
	}
	if groupType != nil {
		updates = append(updates, fmt.Sprintf("type = $%d", idx))
		args = append(args, *groupType)
		idx++
	}
	if enabled != nil {
		updates = append(updates, fmt.Sprintf("enabled = $%d", idx))
		args = append(args, *enabled)
		idx++
	}
	if description != nil {
		updates = append(updates, fmt.Sprintf("description = $%d", idx))
		args = append(args, *description)
		idx++
	}

	updates = append(updates, fmt.Sprintf("updated_at = $%d", idx))
	args = append(args, time.Now().UTC())
	idx++

	args = append(args, id, tenantID)

	query := fmt.Sprintf(`UPDATE condition_groups SET %s WHERE id=$%d AND tenant_id=$%d RETURNING *`,
		strings.Join(updates, ", "), idx, idx+1)

	var row map[string]interface{}
	err := r.db.GetContext(ctx, &row, query, args...)
	if err != nil {
		return nil, err
	}
	return r.rowToGroup(row), nil
}

// DeleteGroup deletes a group by ID and tenant.
func (r *Repository) DeleteGroup(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM condition_groups WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// CreateExpression inserts a new condition expression.
// It validates that the group belongs to the given tenant before inserting.
func (r *Repository) CreateExpression(ctx context.Context, tenantID, groupID string, field, operator, value, valueType string, enabled *bool) (*models.ConditionExpression, error) {
	// Ensure the group belongs to the requesting tenant.
	_, err := r.GetGroup(ctx, tenantID, groupID)
	if err != nil {
		return nil, fmt.Errorf("group %q not found or not accessible: %w", groupID, err)
	}
	id := uuid.New().String()
	now := time.Now().UTC()
	e := true
	if enabled != nil {
		e = *enabled
	}

	query := `INSERT INTO condition_expressions (id, group_id, field, operator, value, value_type, enabled, created_at)
		VALUES (:id, :group_id, :field, :operator, :value, :value_type, :enabled, :created_at)`

	params := map[string]interface{}{
		"id":         id,
		"group_id":   groupID,
		"field":      field,
		"operator":   operator,
		"value":      value,
		"value_type": valueType,
		"enabled":    e,
		"created_at": now,
	}
	_, dbErr := r.db.NamedExecContext(ctx, query, params)
	if dbErr != nil {
		return nil, dbErr
	}

	return &models.ConditionExpression{
		ID:        id,
		GroupID:   groupID,
		Field:     field,
		Operator:  operator,
		Value:     value,
		ValueType: valueType,
		Enabled:   e,
		CreatedAt: now,
	}, nil
}

// GetExpression retrieves an expression by ID, scoped to the given tenant.
func (r *Repository) GetExpression(ctx context.Context, tenantID, id string) (*models.ConditionExpression, error) {
	var row map[string]interface{}
	err := r.db.GetContext(ctx, &row,
		`SELECT e.* FROM condition_expressions e JOIN condition_groups g ON e.group_id = g.id WHERE e.id=$1 AND g.tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return rowToExpression(row), nil
}

// ListExpressions returns expressions for a group, scoped to the given tenant.
func (r *Repository) ListExpressions(ctx context.Context, tenantID, groupID string) ([]models.ConditionExpression, error) {
	// Verify the group belongs to the tenant before listing its expressions.
	if _, err := r.GetGroup(ctx, tenantID, groupID); err != nil {
		return nil, fmt.Errorf("group %q not found or not accessible: %w", groupID, err)
	}
	var rows []map[string]interface{}
	err := r.db.SelectContext(ctx, &rows,
		`SELECT * FROM condition_expressions WHERE group_id=$1 ORDER BY created_at DESC`, groupID)
	if err != nil {
		return nil, err
	}

	exprs := make([]models.ConditionExpression, 0, len(rows))
	for _, row := range rows {
		exprs = append(exprs, *rowToExpression(row))
	}
	return exprs, nil
}

// DeleteExpression deletes an expression by ID, scoped to the given tenant.
func (r *Repository) DeleteExpression(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM condition_expressions e USING condition_groups g WHERE e.group_id = g.id AND e.id=$1 AND g.tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// GroupExists checks if a group exists (by tenant).
func (r *Repository) GroupExists(ctx context.Context, tenantID, groupID string) (bool, error) {
	var exists bool
	err := r.db.GetContext(ctx, &exists,
		`SELECT EXISTS(SELECT 1 FROM condition_groups WHERE id=$1 AND tenant_id=$2)`, groupID, tenantID)
	if err != nil {
		return false, err
	}
	return exists, nil
}

// --- Helpers ---

func toString(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	if b, ok := v.([]byte); ok {
		return string(b)
	}
	return fmt.Sprintf("%v", v)
}

func toTime(v interface{}) time.Time {
	if v == nil {
		return time.Time{}
	}
	if t, ok := v.(time.Time); ok {
		return t
	}
	if s, ok := v.(string); ok {
		t, _ := time.Parse("2006-01-02 15:04:05", s)
		return t
	}
	return time.Time{}
}

func toBool(v interface{}) bool {
	if v == nil {
		return false
	}
	if b, ok := v.(bool); ok {
		return b
	}
	if s, ok := v.(string); ok {
		return s == "true" || s == "1"
	}
	if i, ok := v.(int64); ok {
		return i == 1
	}
	return false
}

func rowToExpression(row map[string]interface{}) *models.ConditionExpression {
	return &models.ConditionExpression{
		ID:        toString(row["id"]),
		GroupID:   toString(row["group_id"]),
		Field:     toString(row["field"]),
		Operator:  toString(row["operator"]),
		Value:     toString(row["value"]),
		ValueType: toString(row["value_type"]),
		Enabled:   toBool(row["enabled"]),
		CreatedAt: toTime(row["created_at"]),
	}
}
