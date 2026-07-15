package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/escalation/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("escalation rule not found")

// Repository provides PostgreSQL-backed persistence for escalation rules.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository instance.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// Create inserts a new escalation policy row.
func (r *Repository) Create(ctx context.Context, rule *models.EscalationRule) error {
	rule.ID = uuid.New().String()
	now := time.Now().UTC()
	rule.CreatedAt = now
	rule.UpdatedAt = now
	if rule.Status == "" {
		rule.Status = "active"
	}
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO escalation_policy (
			id, tenant_id, name, trigger, level, notified_to, description, status, created_at, updated_at
		) VALUES (
			:id, :tenant_id, :name, :trigger, :level, :notified_to, :description, :status, :created_at, :updated_at
		)`, rule)
	return err
}

// GetByID retrieves a single rule by id and tenant_id.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.EscalationRule, error) {
	var rule models.EscalationRule
	err := r.db.GetContext(ctx, &rule,
		`SELECT * FROM escalation_policy WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

// List retrieves rules for a tenant with optional filters and pagination.
func (r *Repository) List(ctx context.Context, tenantID string, q models.ListRulesQuery) ([]models.EscalationRule, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}

	query := "SELECT * FROM escalation_policy WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	idx := 2

	if q.Status != "" {
		query += fmt.Sprintf(" AND status=$%d", idx)
		args = append(args, q.Status)
		idx++
	}
	if q.Level > 0 {
		query += fmt.Sprintf(" AND level=$%d", idx)
		args = append(args, q.Level)
		idx++
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", idx, idx+1)
	args = append(args, q.Limit, q.Offset)

	var rules []models.EscalationRule
	err := r.db.SelectContext(ctx, &rules, query, args...)
	return rules, err
}

// Count returns the total number of rules for a tenant with the same filters.
func (r *Repository) Count(ctx context.Context, tenantID string, q models.ListRulesQuery) (int, error) {
	query := "SELECT COUNT(*) FROM escalation_policy WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	idx := 2

	if q.Status != "" {
		query += fmt.Sprintf(" AND status=$%d", idx)
		args = append(args, q.Status)
		idx++
	}
	if q.Level > 0 {
	query += fmt.Sprintf(" AND level=$%d", idx)
		args = append(args, q.Level)
		idx++
	}

	var count int
	err := r.db.GetContext(ctx, &count, query, args...)
	return count, err
}

// Update patches selected fields of a rule.
func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}
	updates["updated_at"] = time.Now().UTC()
	fields := make([]string, 0, len(updates))
	// stable-ish ordering
	keys := make([]string, 0, len(updates))
	for k := range updates {
		keys = append(keys, k)
	}
	for _, k := range keys {
		fields = append(fields, fmt.Sprintf("%s = :%s", k, k))
	}
	sqlStr := fmt.Sprintf(`UPDATE escalation_policy SET %s WHERE id=$1 AND tenant_id=$2`,
		joinStrings(fields, ", "))
	args := map[string]interface{}{
		"id":        id,
		"tenant_id": tenantID,
	}
	for k, v := range updates {
		args[k] = v
	}
	_, err := r.db.NamedExecContext(ctx, sqlStr, args)
	return err
}

// Delete removes a rule by id and tenant_id.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM escalation_policy WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// RecordEvent persists a trigger event for a rule.
func (r *Repository) RecordEvent(ctx context.Context, ruleID, message string) (*models.TriggerEvent, error) {
	event := &models.TriggerEvent{
		ID:        uuid.New().String(),
		RuleID:    ruleID,
		Message:   message,
		CreatedAt: time.Now().UTC(),
	}
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO escalation_event (id, rule_id, message, created_at)
		VALUES (:id, :rule_id, :message, :created_at)`, event)
	return event, err
}

// GetEventHistory returns the recent trigger events for a rule.
func (r *Repository) GetEventHistory(ctx context.Context, ruleID string) ([]models.TriggerEvent, error) {
	var events []models.TriggerEvent
	err := r.db.SelectContext(ctx, &events,
		`SELECT * FROM escalation_event WHERE rule_id=$1 ORDER BY created_at DESC LIMIT 100`, ruleID)
	return events, err
}

// GetStats returns aggregate stats for a tenant's escalation rules.
func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.EscalationStats, error) {
	stats := &models.EscalationStats{
		ByLevel:  make(map[int]int),
		ByStatus: make(map[string]int),
	}

	var total int
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM escalation_policy WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	stats.TotalRules = total

	var active int
	err = r.db.GetContext(ctx, &active,
		`SELECT COUNT(*) FROM escalation_policy WHERE tenant_id=$1 AND status=$2`, tenantID, "active")
	if err != nil {
		return nil, err
	}
	stats.ActiveRules = active

	var events int
	err = r.db.GetContext(ctx, &events,
		`SELECT COUNT(*) FROM escalation_event e
		 JOIN escalation_policy p ON e.rule_id = p.id
		 WHERE p.tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}
	stats.TotalEvents = events

	var levelRows []map[string]interface{}
	err = r.db.SelectContext(ctx, &levelRows,
		`SELECT level, COUNT(*) AS count FROM escalation_policy WHERE tenant_id=$1 GROUP BY level`, tenantID)
	if err != nil {
		return nil, err
	}
	for _, row := range levelRows {
		stats.ByLevel[int(row["level"].(int64))] = int(row["count"].(int64))
	}

	var statusRows []map[string]interface{}
	err = r.db.SelectContext(ctx, &statusRows,
		`SELECT status, COUNT(*) AS count FROM escalation_policy WHERE tenant_id=$1 GROUP BY status`, tenantID)
	if err != nil {
		return nil, err
	}
	for _, row := range statusRows {
		stats.ByStatus[row["status"].(string)] = int(row["count"].(int64))
	}

	return stats, nil
}

func joinStrings(parts []string, sep string) string {
	if len(parts) == 0 {
		return ""
	}
	result := parts[0]
	for _, p := range parts[1:] {
		result += sep + p
	}
	return result
}
