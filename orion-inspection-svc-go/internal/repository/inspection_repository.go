package repository

import (
	"context"
	"orion/inspection-svc-go/internal/models"
	"github.com/jmoiron/sqlx"
)

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
	if err != nil { return nil, err }
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

func (r *RuleRepository) Count(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM inspections WHERE tenant_id=$1`, tenantID)
	return count, err
}
