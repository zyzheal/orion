package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/data-quality/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Rules ---

func (r *Repository) CreateRule(ctx context.Context, rule *models.Rule) error {
	rule.ID = uuid.New().String()
	rule.CreatedAt = time.Now().UTC()
	rule.UpdatedAt = time.Now().UTC()
	rule.Status = "active"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO data_quality_rules (id, tenant_id, name, description, target_table, target_column, rule_type, expression, threshold, severity, status, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :description, :targetTable, :targetColumn, :ruleType, :expression, :threshold, :severity, :status, :createdAt, :updatedAt)`,
		rule)
	return err
}

func (r *Repository) GetRuleByID(ctx context.Context, tenantID, id string) (*models.Rule, error) {
	var rule models.Rule
	err := r.db.GetContext(ctx, &rule,
		`SELECT * FROM data_quality_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &rule, err
}

func (r *Repository) ListRules(ctx context.Context, tenantID string, filter *models.RuleFilter) ([]models.Rule, error) {
	where := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2

	if filter != nil {
		if filter.RuleType != nil && *filter.RuleType != "" {
			where += fmt.Sprintf(" AND rule_type=$%d", argIdx)
			args = append(args, *filter.RuleType)
			argIdx++
		}
		if filter.Severity != nil && *filter.Severity != "" {
			where += fmt.Sprintf(" AND severity=$%d", argIdx)
			args = append(args, *filter.Severity)
			argIdx++
		}
		if filter.Status != nil && *filter.Status != "" {
			where += fmt.Sprintf(" AND status=$%d", argIdx)
			args = append(args, *filter.Status)
			argIdx++
		}
		if filter.Limit > 0 {
			where += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
			args = append(args, filter.Limit, filter.Offset)
		}
	}

	var rules []models.Rule
	err := r.db.SelectContext(ctx, &rules,
		fmt.Sprintf(`SELECT * FROM data_quality_rules %s ORDER BY created_at DESC`, where), args...)
	return rules, err
}

func (r *Repository) UpdateRule(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Rule, error) {
	if len(updates) == 0 {
		return nil, ErrNotFound
	}
	updates["updated_at"] = time.Now().UTC()
	clauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		clauses = append(clauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE data_quality_rules SET %s WHERE id=$%d AND tenant_id=$%d`,
			joinSetClauses(clauses), i, i+1), args...)
	if err != nil {
		return nil, err
	}
	return r.GetRuleByID(ctx, tenantID, id)
}

func (r *Repository) DeleteRule(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM data_quality_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// --- Scan Results ---

func (r *Repository) CreateScanResult(ctx context.Context, result *models.ScanResult) error {
	result.ID = uuid.New().String()
	result.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO quality_scan_results (id, tenant_id, rule_id, scan_date, total_records, passed_records, failed_records, pass_rate, status, errors, created_at)
		 VALUES (:id, :tenantId, :ruleId, :scanDate, :totalRecords, :passedRecords, :failedRecords, :passRate, :status, :errors, :createdAt)`,
		result)
	return err
}

func (r *Repository) ListScanResults(ctx context.Context, tenantID, ruleID string, status *string) ([]models.ScanResult, error) {
	where := "WHERE tenant_id=$1 AND rule_id=$2"
	args := []interface{}{tenantID, ruleID}
	argIdx := 3
	if status != nil && *status != "" {
		where += fmt.Sprintf(" AND status=$%d", argIdx)
		args = append(args, *status)
	}
	var results []models.ScanResult
	err := r.db.SelectContext(ctx, &results,
		fmt.Sprintf(`SELECT * FROM quality_scan_results %s ORDER BY scan_date DESC`, where), args...)
	return results, err
}

// --- Alerts ---

func (r *Repository) CreateAlert(ctx context.Context, alert *models.Alert) error {
	alert.ID = uuid.New().String()
	alert.CreatedAt = time.Now().UTC()
	alert.UpdatedAt = time.Now().UTC()
	alert.Status = "open"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO quality_alerts (id, tenant_id, rule_id, scan_result_id, message, severity, status, created_at, updated_at)
		 VALUES (:id, :tenantId, :ruleId, :scanResultId, :message, :severity, :status, :createdAt, :updatedAt)`,
		alert)
	return err
}

func (r *Repository) GetAlertByID(ctx context.Context, tenantID, id string) (*models.Alert, error) {
	var a models.Alert
	err := r.db.GetContext(ctx, &a,
		`SELECT * FROM quality_alerts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return &a, err
}

func (r *Repository) ListAlerts(ctx context.Context, tenantID string, status *string) ([]models.Alert, error) {
	where := "WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argIdx := 2
	if status != nil && *status != "" {
		where += fmt.Sprintf(" AND status=$%d", argIdx)
		args = append(args, *status)
		argIdx++
	}
	var alerts []models.Alert
	err := r.db.SelectContext(ctx, &alerts,
		fmt.Sprintf(`SELECT * FROM quality_alerts %s ORDER BY created_at DESC`, where), args...)
	return alerts, err
}

func (r *Repository) UpdateAlert(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.Alert, error) {
	if len(updates) == 0 {
		return nil, ErrNotFound
	}
	updates["updated_at"] = time.Now().UTC()
	clauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		clauses = append(clauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	_, err := r.db.ExecContext(ctx,
		fmt.Sprintf(`UPDATE quality_alerts SET %s WHERE id=$%d AND tenant_id=$%d`,
			joinSetClauses(clauses), i, i+1), args...)
	if err != nil {
		return nil, err
	}
	return r.GetAlertByID(ctx, tenantID, id)
}

func (r *Repository) DeleteAlert(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM quality_alerts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// --- Stats ---

func (r *Repository) GetStats(ctx context.Context, tenantID string) (*models.QualityStats, error) {
	stats := &models.QualityStats{}

	err := r.db.GetContext(ctx, &stats.TotalRules,
		`SELECT COUNT(*) FROM data_quality_rules WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.ActiveRules,
		`SELECT COUNT(*) FROM data_quality_rules WHERE tenant_id=$1 AND status='active'`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.TotalScans,
		`SELECT COUNT(*) FROM quality_scan_results WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.AvgPassRate,
		`SELECT COALESCE(AVG(pass_rate), 0) FROM quality_scan_results WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.OpenAlerts,
		`SELECT COUNT(*) FROM quality_alerts WHERE tenant_id=$1 AND status='open'`, tenantID)
	if err != nil {
		return nil, err
	}

	err = r.db.GetContext(ctx, &stats.CriticalAlerts,
		`SELECT COUNT(*) FROM quality_alerts WHERE tenant_id=$1 AND severity='critical'`, tenantID)

	return stats, err
}

func joinSetClauses(clauses []string) string {
	return strings.Join(clauses, ", ")
}
