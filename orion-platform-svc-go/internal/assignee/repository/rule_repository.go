// Package repository defines the data access layer for the assignee dispatcher.
//
// The assignee dispatcher uses the same PostgreSQL Repository pattern as the rest
// of the platform. All queries include tenant_id for multi-tenant isolation.
package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/assignee/types"

	"orion/go-common/pkg/database"
)

// AssigneeRuleRepository handles CRUD for assignee routing rules.
type AssigneeRuleRepository struct {
	db *database.DB
}

func NewAssigneeRuleRepository(db *database.DB) *AssigneeRuleRepository {
	return &AssigneeRuleRepository{db: db}
}

func (r *AssigneeRuleRepository) Create(ctx context.Context, rule *types.AssigneeRule) error {
	cJSON, err := json.Marshal(rule.Conditions)
	if err != nil {
		return fmt.Errorf("marshal conditions: %w", err)
	}
	tJSON, err := json.Marshal(rule.TargetIDs)
	if err != nil {
		return fmt.Errorf("marshal target_ids: %w", err)
	}
	now := time.Now().UTC()
	rule.CreatedAt = now
	rule.UpdatedAt = now
	query := `INSERT INTO assignee_rules (id, tenant_id, name, conditions, target_ids, strategy, priority, enabled, capacity, weight, cooldown_sec, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`
	result, err := r.db.ExecContext(ctx, query,
		rule.ID, rule.TenantID, rule.Name, string(cJSON), string(tJSON),
		rule.Strategy, rule.Priority, rule.Enabled, rule.Capacity, rule.Weight,
		rule.CooldownSec, rule.CreatedAt, rule.UpdatedAt,
	)
	if err != nil {
		return err
	}
	ids, _ := result.LastInsertId()
	rule.ID = int(ids)
	return nil
}

func (r *AssigneeRuleRepository) Get(ctx context.Context, tenantID string, id int) (*types.AssigneeRule, error) {
	var rule types.AssigneeRule
	var cJSON, tJSON string
	err := r.db.GetContext(ctx, &rule,
		`SELECT id, tenant_id, name, conditions, target_ids, strategy, priority, enabled, capacity, weight, cooldown_sec, created_at, updated_at
		FROM assignee_rules WHERE id=$1 AND tenant_id=$2`,
		id, tenantID)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(cJSON), &rule.Conditions); err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(tJSON), &rule.TargetIDs); err != nil {
		return nil, err
	}
	return &rule, nil
}

func (r *AssigneeRuleRepository) List(ctx context.Context, tenantID string, enabled *bool, limit, offset int) ([]*types.AssigneeRule, error) {
	if limit <= 0 {
		limit = 50
	}
	args := []interface{}{tenantID}
	idx := 2
	conds := []string{"tenant_id=$1"}
	if enabled != nil {
		conds = append(conds, fmt.Sprintf("enabled=$%d", idx))
		args = append(args, *enabled)
		idx++
	}
	where := conds[0]
	for i := 1; i < len(conds); i++ {
		where += fmt.Sprintf(" AND %s", conds[i])
	}
	sql := fmt.Sprintf("SELECT id, tenant_id, name, conditions, target_ids, strategy, priority, enabled, capacity, weight, cooldown_sec, created_at, updated_at FROM assignee_rules WHERE %s ORDER BY priority DESC, created_at DESC LIMIT $%d OFFSET $%d", where, idx, idx+1)
	args = append(args, limit, offset)
	rows, err := r.db.QueryContext(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var rules []*types.AssigneeRule
	for rows.Next() {
		var rule types.AssigneeRule
		var cJSON, tJSON string
		if err := rows.Scan(&rule.ID, &rule.TenantID, &rule.Name, &cJSON, &tJSON,
			&rule.Strategy, &rule.Priority, &rule.Enabled, &rule.Capacity, &rule.Weight,
			&rule.CooldownSec, &rule.CreatedAt, &rule.UpdatedAt); err != nil {
			continue
		}
		if err := json.Unmarshal([]byte(cJSON), &rule.Conditions); err != nil {
			continue
		}
		if err := json.Unmarshal([]byte(tJSON), &rule.TargetIDs); err != nil {
			continue
		}
		rules = append(rules, &rule)
	}
	return rules, nil
}

func (r *AssigneeRuleRepository) Update(ctx context.Context, tenantID string, id int, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	delete(updates, "id")
	delete(updates, "tenant_id")
	if len(updates) == 0 {
		return nil
	}
	var parts []string
	args := []interface{}{id, tenantID}
	idx := 3
	for k := range updates {
		parts = append(parts, fmt.Sprintf("%s=$%d", k, idx))
		args = append(args, updates[k])
		idx++
	}
	set := parts[0]
	for i := 1; i < len(parts); i++ {
		set += ", " + parts[i]
	}
	query := "UPDATE assignee_rules SET " + set + " WHERE id=$1 AND tenant_id=$2"
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

func (r *AssigneeRuleRepository) Delete(ctx context.Context, tenantID string, id int) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM assignee_rules WHERE id=$1 AND tenant_id=$2`,
		id, tenantID)
	return err
}
