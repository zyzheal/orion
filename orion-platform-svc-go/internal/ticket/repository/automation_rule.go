package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/ticket/models"

	"orion/go-common/pkg/database"
	"github.com/google/uuid"
)

type AutomationRuleRepository struct {
	db *database.DB
}

func NewAutomationRuleRepository(db *database.DB) *AutomationRuleRepository {
	return &AutomationRuleRepository{db: db}
}

func (r *AutomationRuleRepository) Create(ctx context.Context, rule *models.AutomationRule) error {
	rule.ID = uuid.New().String()
	rule.CreatedAt = time.Now().UTC()
	rule.UpdatedAt = time.Now().UTC()
	query := `INSERT INTO automation_rules (id, tenant_id, name, description, condition, actions,
		enabled, execution_count, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
	_, err := r.db.ExecContext(ctx, query,
		rule.ID, rule.TenantID, rule.Name, rule.Description, rule.Condition, rule.Actions,
		true, 0, rule.CreatedBy, rule.CreatedAt, rule.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("create automation rule: %w", err)
	}
	return nil
}

func (r *AutomationRuleRepository) GetByID(ctx context.Context, tenantID, id string) (*models.AutomationRule, error) {
	var rule models.AutomationRule
	err := r.db.QueryRowContext(ctx,
		`SELECT id, tenant_id, name, description, condition, actions, enabled, execution_count,
			created_by, created_at, updated_at FROM automation_rules WHERE id = $1 AND tenant_id = $2`,
		id, tenantID).Scan(&rule.ID, &rule.TenantID, &rule.Name, &rule.Description, &rule.Condition, &rule.Actions,
		&rule.Enabled, &rule.ExecutionCount, &rule.CreatedBy, &rule.CreatedAt, &rule.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("automation rule not found")
		}
		return nil, err
	}
	return &rule, nil
}

func (r *AutomationRuleRepository) List(ctx context.Context, tenantID string, enabled *bool) ([]models.AutomationRule, error) {
	var rows *sql.Rows
	var err error
	if enabled != nil {
		rows, err = r.db.QueryContext(ctx,
			`SELECT id, tenant_id, name, description, condition, actions, enabled, execution_count,
				created_by, created_at, updated_at
				FROM automation_rules WHERE tenant_id = $1 AND enabled = $2 ORDER BY name`,
			tenantID, *enabled)
	} else {
		rows, err = r.db.QueryContext(ctx,
			`SELECT id, tenant_id, name, description, condition, actions, enabled, execution_count,
				created_by, created_at, updated_at FROM automation_rules WHERE tenant_id = $1 ORDER BY name`,
			tenantID)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []models.AutomationRule
	for rows.Next() {
		var r models.AutomationRule
		if err := rows.Scan(&r.ID, &r.TenantID, &r.Name, &r.Description, &r.Condition, &r.Actions,
			&r.Enabled, &r.ExecutionCount, &r.CreatedBy, &r.CreatedAt, &r.UpdatedAt); err != nil {
			continue
		}
		rules = append(rules, r)
	}
	return rules, nil
}

func (r *AutomationRuleRepository) Update(ctx context.Context, rule *models.AutomationRule) error {
	rule.UpdatedAt = time.Now().UTC()
	query := `UPDATE automation_rules SET name = $1, description = $2, condition = $3,
		actions = $4, enabled = $5, updated_at = $6
		WHERE id = $7 AND tenant_id = $8`
	result, err := r.db.ExecContext(ctx, query,
		rule.Name, rule.Description, rule.Condition, rule.Actions, rule.Enabled,
		rule.UpdatedAt, rule.ID, rule.TenantID,
	)
	if err != nil {
		return fmt.Errorf("update automation rule: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("automation rule not found")
	}
	return nil
}

func (r *AutomationRuleRepository) Delete(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx, "DELETE FROM automation_rules WHERE id = $1 AND tenant_id = $2", id, tenantID)
	if err != nil {
		return fmt.Errorf("delete automation rule: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("automation rule not found")
	}
	return nil
}

func (r *AutomationRuleRepository) LogExecution(ctx context.Context, exec *models.AutomationRuleExecution) error {
	exec.ID = uuid.New().String()
	exec.CreatedAt = time.Now().UTC()
	query := `INSERT INTO automation_rule_executions (id, rule_id, ticket_id, tenant_id,
		triggered_by, conditions_met, actions_taken, status, error_message, created_at, completed_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
	var completedAt sql.NullTime
	if exec.CompletedAt != nil {
		completedAt = sql.NullTime{Time: *exec.CompletedAt, Valid: true}
	}
	_, err := r.db.ExecContext(ctx, query,
		exec.ID, exec.RuleID, exec.TicketID, exec.TenantID,
		exec.TriggeredBy, exec.ConditionsMet, exec.ActionsTaken, exec.Status,
		exec.ErrorMessage, exec.CreatedAt, completedAt,
	)
	return err
}
