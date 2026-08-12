package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"orion/go-common/pkg/sentinel"
	alertruleengine "orion/platform-svc-go/internal/alert-rule-engine"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository provides PostgreSQL-backed storage for alert rules.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

type ruleRow struct {
	ID          string    `db:"id"`
	TenantID    string    `db:"tenant_id"`
	Name        string    `db:"name"`
	Expression  string    `db:"expression"`
	Priority    int       `db:"priority"`
	Enabled     bool      `db:"enabled"`
	Group       string    `db:"group"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
}

func (r *Repository) Save(ctx context.Context, tenantID string, rule *alertruleengine.Rule) error {
	if rule.ID == "" {
		rule.ID = uuid.New().String()
	}
	now := time.Now().UTC()
	if rule.CreatedAt.IsZero() {
		rule.CreatedAt = now
	}
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO alert_rules (id, tenant_id, name, expression, priority, enabled, "group", created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :expression, :priority, :enabled, :group, :created_at, :updated_at)
		ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, expression=EXCLUDED.expression,
			priority=EXCLUDED.priority, enabled=EXCLUDED.enabled, "group"=EXCLUDED."group", updated_at=NOW()`,
		ruleMap(rule, tenantID))
	return err
}

func (r *Repository) Get(ctx context.Context, tenantID, ruleID string) (*alertruleengine.Rule, error) {
	var row ruleRow
	err := r.db.GetContext(ctx, &row, `SELECT * FROM alert_rules WHERE id=$1 AND tenant_id=$2`, ruleID, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	if err != nil {
		return nil, err
	}
	return rowToRule(&row), nil
}

func (r *Repository) ListByTenant(ctx context.Context, tenantID string) []*alertruleengine.Rule {
	var rows []ruleRow
	err := r.db.SelectContext(ctx, &rows, `SELECT * FROM alert_rules WHERE tenant_id=$1 ORDER BY priority ASC`)
	if err != nil {
		return []*alertruleengine.Rule{}
	}
	result := make([]*alertruleengine.Rule, len(rows))
	for i := range rows {
		result[i] = rowToRule(&rows[i])
	}
	return result
}

func (r *Repository) Delete(ctx context.Context, tenantID, ruleID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM alert_rules WHERE id=$1 AND tenant_id=$2`, ruleID, tenantID)
	return err
}

func (r *Repository) ListByGroup(ctx context.Context, tenantID, group string) []*alertruleengine.Rule {
	var rows []ruleRow
	err := r.db.SelectContext(ctx, &rows, `SELECT * FROM alert_rules WHERE tenant_id=$1 AND "group"=$2 ORDER BY priority ASC`, tenantID, group)
	if err != nil {
		return []*alertruleengine.Rule{}
	}
	result := make([]*alertruleengine.Rule, len(rows))
	for i := range rows {
		result[i] = rowToRule(&rows[i])
	}
	return result
}

func ruleMap(rule *alertruleengine.Rule, tenantID string) map[string]interface{} {
	return map[string]interface{}{
		"id":         rule.ID,
		"tenant_id":  tenantID,
		"name":       rule.Name,
		"expression": rule.Expression,
		"priority":   rule.Priority,
		"enabled":    rule.Enabled,
		"group":      rule.Group,
		"created_at": rule.CreatedAt,
		"updated_at": rule.UpdatedAt,
	}
}

func rowToRule(row *ruleRow) *alertruleengine.Rule {
	return &alertruleengine.Rule{
		ID:         row.ID,
		Name:       row.Name,
		Expression: row.Expression,
		Priority:   row.Priority,
		Enabled:    row.Enabled,
		Group:      row.Group,
		CreatedAt:  row.CreatedAt,
		UpdatedAt:  row.UpdatedAt,
	}
}

// Ensure imports are used
var _ = sentinel.NotFound
var _ = json.Marshal