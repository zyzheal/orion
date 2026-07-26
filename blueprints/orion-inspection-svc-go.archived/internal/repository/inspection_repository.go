package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/inspection-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

// --- RuleRepository ---

type RuleRepository struct { db *sqlx.DB }
func NewRuleRepository(db *sqlx.DB) *RuleRepository { return &RuleRepository{db: db} }

func (r *RuleRepository) Create(ctx context.Context, d *models.InspectionRule) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO inspection_rules (id, tenant_id, name, description, rule_type, target, condition, severity, enabled, schedule) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, d.ID, d.TenantID, d.Name, d.Description, d.RuleType, d.Target, d.Condition, d.Severity, d.Enabled, d.Schedule)
	return err
}

func (r *RuleRepository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.InspectionRule, error) {
	var items []models.InspectionRule
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM inspection_rules WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *RuleRepository) GetByID(ctx context.Context, tenantID, id string) (*models.InspectionRule, error) {
	var d models.InspectionRule
	err := r.db.GetContext(ctx, &d, `SELECT * FROM inspection_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *RuleRepository) Update(ctx context.Context, d *models.InspectionRule) error {
	_, err := r.db.ExecContext(ctx, `UPDATE inspection_rules SET name=$1, description=$2, rule_type=$3, target=$4, condition=$5, severity=$6, enabled=$7, schedule=$8, updated_at=NOW() WHERE id=$9 AND tenant_id=$10`, d.Name, d.Description, d.RuleType, d.Target, d.Condition, d.Severity, d.Enabled, d.Schedule, d.ID, d.TenantID)
	return err
}

func (r *RuleRepository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM inspection_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *RuleRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM inspection_rules WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ListEnabled returns all enabled rules for a tenant.
func (r *RuleRepository) ListEnabled(ctx context.Context, tenantID string) ([]models.InspectionRule, error) {
	var items []models.InspectionRule
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM inspection_rules WHERE tenant_id=$1 AND enabled=$2`, tenantID, true)
	return items, err
}

func (r *RuleRepository) ListByIDs(ctx context.Context, tenantID string, ids []string) ([]models.InspectionRule, error) {
	var items []models.InspectionRule
	if len(ids) == 0 {
		return items, nil
	}
	query, args, err := sqlx.Named(`SELECT * FROM inspection_rules WHERE tenant_id=:tenant_id AND id=ANY(:ids)`, map[string]interface{}{"tenant_id": tenantID, "ids": ids})
	if err != nil {
		return nil, err
	}
	query = r.db.Rebind(query)
	err = r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

// ListByTenant retrieves all rules for a tenant.
func (r *RuleRepository) ListByTenant(ctx context.Context, tenantID string) ([]models.InspectionRule, error) {
	var items []models.InspectionRule
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM inspection_rules WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

// ListByTenantAndEnabled retrieves rules for a tenant filtered by enabled.
func (r *RuleRepository) ListByTenantAndEnabled(ctx context.Context, tenantID string, enabled bool) ([]models.InspectionRule, error) {
	var items []models.InspectionRule
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM inspection_rules WHERE tenant_id=$1 AND enabled=$2 ORDER BY created_at DESC`, tenantID, enabled)
	return items, err
}

// ListByTenantAndTarget retrieves rules for a tenant filtered by target.
func (r *RuleRepository) ListByTenantAndTarget(ctx context.Context, tenantID, target string) ([]models.InspectionRule, error) {
	var items []models.InspectionRule
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM inspection_rules WHERE tenant_id=$1 AND target=$2 ORDER BY created_at DESC`, tenantID, target)
	return items, err
}

// ListByTenantAndTargetAndEnabled retrieves rules for a tenant filtered by target and enabled.
func (r *RuleRepository) ListByTenantAndTargetAndEnabled(ctx context.Context, tenantID, target string, enabled bool) ([]models.InspectionRule, error) {
	var items []models.InspectionRule
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM inspection_rules WHERE tenant_id=$1 AND target=$2 AND enabled=$3 ORDER BY created_at DESC`, tenantID, target, enabled)
	return items, err
}

// GetByTenantAndID retrieves a single rule by tenant and ID.
func (r *RuleRepository) GetByTenantAndID(ctx context.Context, tenantID, id string) (*models.InspectionRule, error) {
	return r.GetByID(ctx, tenantID, id)
}

// DeleteByTenantAndID deletes a rule scoped to tenant.
func (r *RuleRepository) DeleteByTenantAndID(ctx context.Context, tenantID, id string) error {
	return r.Delete(ctx, tenantID, id)
}

// --- ResultRepository ---

type ResultRepository struct { db *sqlx.DB }
func NewResultRepository(db *sqlx.DB) *ResultRepository { return &ResultRepository{db: db} }

func (r *ResultRepository) Create(ctx context.Context, d *models.InspectionResult) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO inspection_results (id, tenant_id, rule_id, rule_name, status, target, details, remediation, executed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, d.ID, d.TenantID, d.RuleID, d.RuleName, d.Status, d.Target, d.Details, d.Remediation, d.ExecutedAt)
	return err
}

func (r *ResultRepository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.InspectionResult, error) {
	var items []models.InspectionResult
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM inspection_results WHERE tenant_id=$1 ORDER BY executed_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

func (r *ResultRepository) ListByRule(ctx context.Context, tenantID, ruleID string, offset, limit int) ([]models.InspectionResult, error) {
	var items []models.InspectionResult
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM inspection_results WHERE tenant_id=$1 AND rule_id=$2 ORDER BY executed_at DESC OFFSET $3 LIMIT $4`, tenantID, ruleID, offset, limit)
	return items, err
}

func (r *ResultRepository) GetByID(ctx context.Context, id string) (*models.InspectionResult, error) {
	var d models.InspectionResult
	err := r.db.GetContext(ctx, &d, `SELECT * FROM inspection_results WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// GetByTenantAndID retrieves a single result by tenant and ID.
func (r *ResultRepository) GetByTenantAndID(ctx context.Context, tenantID, id string) (*models.InspectionResult, error) {
	var d models.InspectionResult
	err := r.db.GetContext(ctx, &d, `SELECT * FROM inspection_results WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// ListByTenant retrieves all results for a tenant.
func (r *ResultRepository) ListByTenant(ctx context.Context, tenantID string) ([]models.InspectionResult, error) {
	var items []models.InspectionResult
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM inspection_results WHERE tenant_id=$1 ORDER BY executed_at DESC`, tenantID)
	return items, err
}

// ListByRuleAndTenant retrieves results for a rule within a tenant.
func (r *ResultRepository) ListByRuleAndTenant(ctx context.Context, ruleID, tenantID string) ([]models.InspectionResult, error) {
	var items []models.InspectionResult
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM inspection_results WHERE tenant_id=$1 AND rule_id=$2 ORDER BY executed_at DESC`, tenantID, ruleID)
	return items, err
}

// --- TaskRepository ---

type TaskRepository struct { db *sqlx.DB }
func NewTaskRepository(db *sqlx.DB) *TaskRepository { return &TaskRepository{db: db} }

func (r *TaskRepository) Create(ctx context.Context, t *models.InspectionTask) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO inspection_tasks (id, tenant_id, rule_id, status, created_at) VALUES ($1,$2,$3,$4,$5)`, t.ID, t.TenantID, t.RuleID, t.Status, t.CreatedAt)
	return err
}

func (r *TaskRepository) GetByID(ctx context.Context, id string) (*models.InspectionTask, error) {
	var t models.InspectionTask
	err := r.db.GetContext(ctx, &t, `SELECT * FROM inspection_tasks WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *TaskRepository) UpdateStatus(ctx context.Context, id string, status string, resultID string, completedAt *time.Time) error {
	var query string
	var args []interface{}
	if completedAt != nil {
		query = `UPDATE inspection_tasks SET status=$1, result_id=$2, completed_at=$3 WHERE id=$4`
		args = []interface{}{status, resultID, completedAt, id}
	} else {
		query = `UPDATE inspection_tasks SET status=$1 WHERE id=$2`
		args = []interface{}{status, id}
	}
	_, err := r.db.ExecContext(ctx, query, args...)
	return err
}

func (r *TaskRepository) List(ctx context.Context, tenantID string, ruleID, status string, offset, limit int) ([]models.InspectionTask, error) {
	var items []models.InspectionTask
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM inspection_tasks WHERE tenant_id=$1 AND rule_id=$2 AND status=$3 ORDER BY created_at DESC OFFSET $4 LIMIT $5`, tenantID, ruleID, status, offset, limit)
	return items, err
}

func (r *TaskRepository) FindRecentCompleted(ctx context.Context, tenantID string, limit int) ([]models.InspectionTask, error) {
	var items []models.InspectionTask
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM inspection_tasks WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT $3`, tenantID, "completed", limit)
	return items, err
}

// ListByTenant retrieves all tasks for a tenant.
func (r *TaskRepository) ListByTenant(ctx context.Context, tenantID string) ([]models.InspectionTask, error) {
	var items []models.InspectionTask
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM inspection_tasks WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

// ListByTenantAndRule retrieves tasks for a tenant and rule.
func (r *TaskRepository) ListByTenantAndRule(ctx context.Context, tenantID, ruleID string) ([]models.InspectionTask, error) {
	var items []models.InspectionTask
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM inspection_tasks WHERE tenant_id=$1 AND rule_id=$2 ORDER BY created_at DESC`, tenantID, ruleID)
	return items, err
}

// ListByTenantAndStatus retrieves tasks for a tenant filtered by status.
func (r *TaskRepository) ListByTenantAndStatus(ctx context.Context, tenantID, status string) ([]models.InspectionTask, error) {
	var items []models.InspectionTask
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM inspection_tasks WHERE tenant_id=$1 AND status=$2 ORDER BY created_at DESC`, tenantID, status)
	return items, err
}

// ListByTenantAndRuleAndStatus retrieves tasks for a tenant, rule, and status.
func (r *TaskRepository) ListByTenantAndRuleAndStatus(ctx context.Context, tenantID, ruleID, status string) ([]models.InspectionTask, error) {
	var items []models.InspectionTask
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM inspection_tasks WHERE tenant_id=$1 AND rule_id=$2 AND status=$3 ORDER BY created_at DESC`, tenantID, ruleID, status)
	return items, err
}

// GetByTenantAndID retrieves a single task by tenant and ID.
func (r *TaskRepository) GetByTenantAndID(ctx context.Context, tenantID, id string) (*models.InspectionTask, error) {
	var t models.InspectionTask
	err := r.db.GetContext(ctx, &t, `SELECT * FROM inspection_tasks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// --- ReportRepository ---

type ReportRepository struct { db *sqlx.DB }
func NewReportRepository(db *sqlx.DB) *ReportRepository { return &ReportRepository{db: db} }

func (r *ReportRepository) Create(ctx context.Context, rpt *models.InspectionReport) error {
	summaryJSON, err := json.Marshal(rpt.Summary)
	if err != nil {
		return fmt.Errorf("marshal report summary: %w", err)
	}
	_, err = r.db.ExecContext(ctx, `INSERT INTO inspection_reports (id, tenant_id, title, summary, generated_at) VALUES ($1,$2,$3,$4,$5)`, rpt.ID, rpt.TenantID, rpt.Title, summaryJSON, rpt.GeneratedAt)
	return err
}

func (r *ReportRepository) GetByID(ctx context.Context, id string) (*models.InspectionReport, error) {
	var rpt models.InspectionReport
	err := r.db.GetContext(ctx, &rpt, `SELECT * FROM inspection_reports WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &rpt, nil
}

func (r *ReportRepository) List(ctx context.Context, tenantID string, offset, limit int) ([]models.InspectionReport, error) {
	var items []models.InspectionReport
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM inspection_reports WHERE tenant_id=$1 ORDER BY generated_at DESC OFFSET $2 LIMIT $3`, tenantID, offset, limit)
	return items, err
}

// ListByTenant retrieves all reports for a tenant.
func (r *ReportRepository) ListByTenant(ctx context.Context, tenantID string) ([]models.InspectionReport, error) {
	var items []models.InspectionReport
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM inspection_reports WHERE tenant_id=$1 ORDER BY generated_at DESC`, tenantID)
	return items, err
}

// GetByTenantAndID retrieves a single report by tenant and ID.
func (r *ReportRepository) GetByTenantAndID(ctx context.Context, tenantID, id string) (*models.InspectionReport, error) {
	var rpt models.InspectionReport
	err := r.db.GetContext(ctx, &rpt, `SELECT * FROM inspection_reports WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &rpt, nil
}
