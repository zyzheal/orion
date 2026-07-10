package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"orion/selfhealing-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides data access for all self-healing entities.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ==================== Healing Rules ====================

// Create inserts a new healing rule.
func (r *Repository) Create(ctx context.Context, d *models.HealingRule) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO healing_rules (id, tenant_id, name, trigger_type, action, status, config, enabled, execution_count)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		d.ID, d.TenantID, d.Name, d.TriggerType, d.Action, d.Status, d.Config, d.Enabled, d.ExecutionCount)
	return err
}

// List returns healing rules with pagination.
func (r *Repository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.HealingRule, error) {
	var items []models.HealingRule
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM healing_rules WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

// GetByID returns a healing rule by ID.
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.HealingRule, error) {
	var d models.HealingRule
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM healing_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// Update updates a healing rule.
func (r *Repository) Update(ctx context.Context, tenantID, id string, req *models.UpdateHealingRuleRequest) (*models.HealingRule, error) {
	setClauses := []string{}
	args := []interface{}{}
	idx := 1

	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name=$%d", idx))
		args = append(args, *req.Name)
		idx++
	}
	if req.TriggerType != nil {
		setClauses = append(setClauses, fmt.Sprintf("trigger_type=$%d", idx))
		args = append(args, *req.TriggerType)
		idx++
	}
	if req.Action != nil {
		setClauses = append(setClauses, fmt.Sprintf("action=$%d", idx))
		args = append(args, *req.Action)
		idx++
	}
	if req.Config != nil {
		setClauses = append(setClauses, fmt.Sprintf("config=$%d", idx))
		args = append(args, req.Config)
		idx++
	}
	if req.Enabled != nil {
		setClauses = append(setClauses, fmt.Sprintf("enabled=$%d", idx))
		args = append(args, *req.Enabled)
		idx++
	}

	if len(setClauses) == 0 {
		return r.GetByID(ctx, tenantID, id)
	}

	setClauses = append(setClauses, "updated_at=NOW()")
	args = append(args, id, tenantID)

	query := fmt.Sprintf("UPDATE healing_rules SET %s WHERE id=$%d AND tenant_id=$%d RETURNING *",
		strings.Join(setClauses, ", "), idx, idx+1)

	var d models.HealingRule
	err := r.db.GetContext(ctx, &d, query, args...)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// Delete removes a healing rule.
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM healing_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// Count returns the total number of healing rules for a tenant.
func (r *Repository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM healing_rules WHERE tenant_id=$1`, tenantID)
	return count, err
}

// IncrementExecutionCount increments the execution count and updates last_triggered.
func (r *Repository) IncrementExecutionCount(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE healing_rules SET execution_count = execution_count + 1, last_triggered = NOW(), updated_at = NOW() WHERE id = $1`, id)
	return err
}

// ==================== Healing Strategies ====================

// CreateStrategy inserts a new healing strategy.
func (r *Repository) CreateStrategy(ctx context.Context, s *models.HealingStrategy) error {
	actions, _ := json.Marshal(s.Actions)
	conditions, _ := json.Marshal(s.Conditions)
	envs, _ := json.Marshal(s.Environments)

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO healing_strategies (id, name, trigger_type, actions, conditions, confidence, enabled,
		  description, environments, max_retries, retry_cooldown_ms)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		 ON CONFLICT (id) DO UPDATE SET
		 	name=$2, trigger_type=$3, actions=$4, conditions=$5, confidence=$6, enabled=$7,
		 	description=$8, environments=$9, max_retries=$10, retry_cooldown_ms=$11, updated_at=NOW()`,
		s.ID, s.Name, string(s.TriggerType), actions, conditions, s.Confidence, s.Enabled,
		s.Description, envs, &s.MaxRetries, &s.RetryCooldownMs)
	return err
}

// FindStrategyByID returns a strategy by ID.
func (r *Repository) FindStrategyByID(ctx context.Context, id string) (*models.HealingStrategy, error) {
	var s models.HealingStrategy
	err := r.db.GetContext(ctx, &s,
		`SELECT id, name, trigger_type, actions, conditions, confidence, enabled,
		  description, environments, max_retries, retry_cooldown_ms, created_at, updated_at
		 FROM healing_strategies WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// FindEnabledStrategies returns all enabled strategies.
func (r *Repository) FindEnabledStrategies(ctx context.Context) ([]models.HealingStrategy, error) {
	var items []models.HealingStrategy
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, name, trigger_type, actions, conditions, confidence, enabled,
		  description, environments, max_retries, retry_cooldown_ms, created_at, updated_at
		 FROM healing_strategies WHERE enabled=$1 ORDER BY confidence DESC`, true)
	return items, err
}

// FindAllStrategies returns all strategies.
func (r *Repository) FindAllStrategies(ctx context.Context) ([]models.HealingStrategy, error) {
	var items []models.HealingStrategy
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, name, trigger_type, actions, conditions, confidence, enabled,
		  description, environments, max_retries, retry_cooldown_ms, created_at, updated_at
		 FROM healing_strategies ORDER BY created_at DESC`)
	return items, err
}

// DeleteStrategy removes a strategy.
func (r *Repository) DeleteStrategy(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM healing_strategies WHERE id=$1`, id)
	return err
}

// SetStrategyEnabled updates the enabled flag of a strategy.
func (r *Repository) SetStrategyEnabled(ctx context.Context, id string, enabled bool) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE healing_strategies SET enabled=$1, updated_at=NOW() WHERE id=$2`, enabled, id)
	return err
}

// SeedStrategy inserts a strategy only if it does not exist.
func (r *Repository) SeedStrategy(ctx context.Context, s *models.HealingStrategy) error {
	actions, _ := json.Marshal(s.Actions)
	conditions, _ := json.Marshal(s.Conditions)
	envs, _ := json.Marshal(s.Environments)

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO healing_strategies (id, name, trigger_type, actions, conditions, confidence, enabled,
		  description, environments, max_retries, retry_cooldown_ms)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		 ON CONFLICT (id) DO NOTHING`,
		s.ID, s.Name, string(s.TriggerType), actions, conditions, s.Confidence, s.Enabled,
		s.Description, envs, &s.MaxRetries, &s.RetryCooldownMs)
	return err
}

// ==================== Healing Incidents ====================

// CreateIncident inserts a new healing incident.
func (r *Repository) CreateIncident(ctx context.Context, inc *models.HealingIncident) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO healing_incidents
		 (id, tenant_id, alert_id, type, severity, app_name, environment,
		  strategy_id, strategy_name, actions, status, attempts,
		  approval_status, approval_request_id, tags)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
		inc.ID, inc.TenantID, inc.AlertID, string(inc.Type), string(inc.Severity),
		inc.AppName, inc.Environment, inc.StrategyID, inc.StrategyName,
		inc.Actions, string(inc.Status), inc.Attempts,
		nullApprovalStr(inc.ApprovalStatus), inc.ApprovalRequestID, inc.Tags)
	return err
}

// FindIncidentByID returns an incident by ID.
func (r *Repository) FindIncidentByID(ctx context.Context, id string) (*models.HealingIncident, error) {
	var db models.HealingIncidentDB
	err := r.db.GetContext(ctx, &db,
		`SELECT id, tenant_id, alert_id, type, severity, app_name, environment,
		        strategy_id, strategy_name, actions, status, attempts,
		        approval_status, approval_request_id, result, error, tags, started_at, completed_at
		 FROM healing_incidents WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	inc := db.ToIncident()
	return &inc, nil
}

// FindIncidents returns incidents with filters and pagination.
func (r *Repository) FindIncidents(ctx context.Context, tenantID string, q *models.HistoryQuery) ([]models.HealingIncident, int, error) {
	conditions := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	idx := 2

	if q.AppName != nil {
		conditions = append(conditions, fmt.Sprintf("app_name = $%d", idx))
		args = append(args, *q.AppName)
		idx++
	}
	if q.Environment != nil {
		conditions = append(conditions, fmt.Sprintf("environment = $%d", idx))
		args = append(args, *q.Environment)
		idx++
	}
	if q.Type != nil {
		conditions = append(conditions, fmt.Sprintf("type = $%d", idx))
		args = append(args, *q.Type)
		idx++
	}
	if q.Status != nil {
		conditions = append(conditions, fmt.Sprintf("status = $%d", idx))
		args = append(args, *q.Status)
		idx++
	}
	if q.Severity != nil {
		conditions = append(conditions, fmt.Sprintf("severity = $%d", idx))
		args = append(args, *q.Severity)
		idx++
	}
	if q.StartDate != nil {
		conditions = append(conditions, fmt.Sprintf("started_at >= $%d", idx))
		args = append(args, *q.StartDate)
		idx++
	}
	if q.EndDate != nil {
		conditions = append(conditions, fmt.Sprintf("started_at <= $%d", idx))
		args = append(args, *q.EndDate)
		idx++
	}

	where := strings.Join(conditions, " AND ")

	// Count
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM healing_incidents WHERE %s", where)
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}

	// Data
	limit := q.PageSize
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	offset := (q.Page - 1) * limit
	if q.Page <= 0 {
		offset = 0
	}
	args = append(args, limit, offset)
	dataQuery := fmt.Sprintf(
		`SELECT id, tenant_id, alert_id, type, severity, app_name, environment,
		        strategy_id, strategy_name, actions, status, attempts,
		        approval_status, approval_request_id, result, error, tags, started_at, completed_at
		 FROM healing_incidents WHERE %s ORDER BY started_at DESC LIMIT $%d OFFSET $%d`,
		where, idx, idx+1)

	var dbRows []models.HealingIncidentDB
	if err := r.db.SelectContext(ctx, &dbRows, dataQuery, args...); err != nil {
		return nil, 0, err
	}

	incidents := make([]models.HealingIncident, len(dbRows))
	for i, row := range dbRows {
		incidents[i] = row.ToIncident()
	}
	return incidents, total, nil
}

// UpdateIncident updates an incident.
func (r *Repository) UpdateIncident(ctx context.Context, id string, updates map[string]interface{}) error {
	setClauses := []string{}
	args := []interface{}{}
	idx := 1

	for col, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s=$%d", col, idx))
		args = append(args, val)
		idx++
	}

	if len(setClauses) == 0 {
		return nil
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE healing_incidents SET %s WHERE id=$%d", strings.Join(setClauses, ", "), idx)
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

// GetAllIncidentsForStats returns all incidents matching filters for stats computation.
func (r *Repository) GetAllIncidentsForStats(ctx context.Context, tenantID string, q *models.EffectivenessQuery) ([]models.HealingIncident, error) {
	conditions := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	idx := 2

	if q.AppName != nil {
		conditions = append(conditions, fmt.Sprintf("app_name = $%d", idx))
		args = append(args, *q.AppName)
		idx++
	}
	if q.Environment != nil {
		conditions = append(conditions, fmt.Sprintf("environment = $%d", idx))
		args = append(args, *q.Environment)
		idx++
	}
	if q.StartDate != nil {
		conditions = append(conditions, fmt.Sprintf("started_at >= $%d", idx))
		args = append(args, *q.StartDate)
		idx++
	}
	if q.EndDate != nil {
		conditions = append(conditions, fmt.Sprintf("started_at <= $%d", idx))
		args = append(args, *q.EndDate)
		idx++
	}

	where := strings.Join(conditions, " AND ")
	query := fmt.Sprintf(
		`SELECT id, tenant_id, alert_id, type, severity, app_name, environment,
		        strategy_id, strategy_name, actions, status, attempts,
		        approval_status, approval_request_id, result, error, tags, started_at, completed_at
		 FROM healing_incidents WHERE %s ORDER BY started_at DESC LIMIT 10000`, where)

	var dbRows []models.HealingIncidentDB
	if err := r.db.SelectContext(ctx, &dbRows, query, args...); err != nil {
		return nil, err
	}

	incidents := make([]models.HealingIncident, len(dbRows))
	for i, row := range dbRows {
		incidents[i] = row.ToIncident()
	}
	return incidents, nil
}

// ==================== Approval Requests ====================

// CreateApproval inserts a new approval request.
func (r *Repository) CreateApproval(ctx context.Context, a *models.ApprovalRequest) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO healing_approvals
		 (id, tenant_id, incident_id, title, description, risk_level, recommended_actions,
		  status, requested_by, expires_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		a.ID, a.TenantID, a.IncidentID, a.Title, a.Description, string(a.RiskLevel),
		a.RecommendedActions, string(a.Status), a.RequestedBy, a.ExpiresAt)
	return err
}

// FindApprovalByID returns an approval request by ID.
func (r *Repository) FindApprovalByID(ctx context.Context, id string) (*models.ApprovalRequest, error) {
	var a models.ApprovalRequest
	err := r.db.GetContext(ctx, &a,
		`SELECT id, tenant_id, incident_id, title, description, risk_level, recommended_actions,
		        status, requested_by, approved_by, approval_reason, requested_at, responded_at, expires_at
		 FROM healing_approvals WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// FindApprovalsByStatus returns approval requests filtered by status.
func (r *Repository) FindApprovalsByStatus(ctx context.Context, tenantID string, status *string) ([]models.ApprovalRequest, error) {
	var items []models.ApprovalRequest
	var err error
	if status != nil {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, incident_id, title, description, risk_level, recommended_actions,
			        status, requested_by, approved_by, approval_reason, requested_at, responded_at, expires_at
			 FROM healing_approvals WHERE tenant_id=$1 AND status=$2 ORDER BY requested_at DESC`,
			tenantID, *status)
	} else {
		err = r.db.SelectContext(ctx, &items,
			`SELECT id, tenant_id, incident_id, title, description, risk_level, recommended_actions,
			        status, requested_by, approved_by, approval_reason, requested_at, responded_at, expires_at
			 FROM healing_approvals WHERE tenant_id=$1 ORDER BY requested_at DESC`,
			tenantID)
	}
	return items, err
}

// UpdateApproval updates an approval request.
func (r *Repository) UpdateApproval(ctx context.Context, id string, status string, approvedBy *string, reason *string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE healing_approvals SET status=$1, approved_by=$2, approval_reason=$3, responded_at=NOW()
		 WHERE id=$4`,
		status, approvedBy, reason, id)
	return err
}

// MarkExpiredApprovals marks all pending expired approvals as expired.
func (r *Repository) MarkExpiredApprovals(ctx context.Context) (int64, error) {
	result, err := r.db.ExecContext(ctx,
		`UPDATE healing_approvals SET status='expired'
		 WHERE status='pending' AND expires_at IS NOT NULL AND expires_at < NOW()`)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// ==================== Rule Executions ====================

// CreateExecution inserts a new rule execution.
func (r *Repository) CreateExecution(ctx context.Context, e *models.HealingExecution) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO healing_executions (id, rule_id, trigger_event, status)
		 VALUES ($1, $2, $3, $4)`,
		e.ID, e.RuleID, e.TriggerEvent, string(e.Status))
	return err
}

// CompleteExecution updates an execution as completed.
func (r *Repository) CompleteExecution(ctx context.Context, id string, status models.ExecutionStatus, result models.JSONB, errMsg *string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE healing_executions SET status=$1, result=$2, error_message=$3, completed_at=NOW()
		 WHERE id=$4`,
		string(status), result, errMsg, id)
	return err
}

// FindExecutionsByRule returns executions for a given rule.
func (r *Repository) FindExecutionsByRule(ctx context.Context, ruleID string, limit int) ([]models.HealingExecution, error) {
	var items []models.HealingExecution
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM healing_executions WHERE rule_id=$1 ORDER BY started_at DESC LIMIT $2`,
		ruleID, limit)
	return items, err
}

// ==================== Guardian Audit ====================

// InsertAudit inserts a guardian audit entry.
func (r *Repository) InsertAudit(ctx context.Context, a *models.HealingAuditEntry) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO guardian_audit (id, tenant_id, incident_id, action_type, target, environment,
		  risk_level, approvers, executor, status, reason, result)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		a.ID, "", a.IncidentID, a.ActionType, a.Target, a.Environment,
		string(a.RiskLevel), a.Approvers, a.Executor, a.Status, a.Reason, a.Result)
	return err
}

// FindAuditsByIncident returns audit entries for an incident.
func (r *Repository) FindAuditsByIncident(ctx context.Context, tenantID string, incidentID string, limit int) ([]models.HealingAuditEntry, error) {
	var items []models.HealingAuditEntry
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM guardian_audit WHERE tenant_id=$1 AND incident_id=$2 ORDER BY created_at DESC LIMIT $3`,
		tenantID, incidentID, limit)
	return items, err
}

// CountAudits returns total audit count for a tenant.
func (r *Repository) CountAudits(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM guardian_audit WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ==================== Helpers ====================

func nullApprovalStr(s *models.ApprovalStatus) sql.NullString {
	if s == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: string(*s), Valid: true}
}

// timePtr returns a pointer to a time value.
func timePtr(t time.Time) *time.Time {
	return &t
}

// jsonMarshal is a helper to marshal to JSON bytes.
func jsonMarshal(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}
