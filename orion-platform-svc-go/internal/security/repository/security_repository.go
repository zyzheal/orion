package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/security/models"

	"github.com/jmoiron/sqlx"
)

// Every SELECT below names its columns explicitly instead of using *.
//
// The six tables that 580 creates (security_scans, security_findings,
// compliance_evaluations, supply_chain_sboms, dependency_graphs,
// dependency_poisoning_scans) are owned by this module alone and carry no
// soft-delete or audit columns. The other four (audit_plans, audit_executions,
// audit_findings, compliance_policies) were created by 066 for
// internal/security-compliance and then extended: 571 added deleted_at to all
// four, 572 added created_by and updated_by (plus created_at / updated_at to
// three of them), 577 added audit_findings.resolution and .target, and 580
// added the columns this module's models declare. sqlx scans in safe mode --
// go-common's database.Connect goes through sqlx.Open and never calls Unsafe --
// so `SELECT *` returned a deleted_at column that no model here declares, and
// the scan failed on the very first row with
// "missing destination name deleted_at in *models.AuditPlan". That error is not
// sql.ErrNoRows, so it propagated out of the repository, out of the service,
// and every read endpoint in this module answered 500 instead of data.
//
// Naming the columns returns exactly the fields the models declare, so the
// soft-delete and audit columns are never handed to the scanner and no model
// change is needed for them.
//
// created_by is selected as text. 572 created it as
// `UUID REFERENCES users(id)`. The cast is a guard, not a fix: both drivers in
// use already hand a uuid column to database/sql as its textual form. lib/pq
// returns []byte of the 36-character form (its own TestDecodeUUIDBackend
// asserts exactly that), which database/sql then converts to string, and pgx v5
// returns string for the database/sql bridge via UUIDCodec.
// DecodeDatabaseSQLValue -> encodeUUID. Only the raw pgx row API yields the
// 16-byte form (UUIDCodec.DecodeValue returns uuid.Bytes), so the cast is a
// no-op today but keeps CreatedBy readable if the connection ever switches to
// that path.
const (
	scanColumns             = "id, tenant_id, scan_type, target, scanner, status, critical_count, high_count, medium_count, low_count, total_count, passed, gate_failed, scan_start_time, scan_end_time, duration_ms, result, created_at"
	findingColumns          = "id, tenant_id, scan_id, rule_id, severity, category, title, description, file_path, line_start, line_end, code_snippet, match_text, confidence, remediation, status, assigned_to, closed_at, created_at"
	auditPlanColumns        = "id, tenant_id, name, description, scope, audit_type, schedule_type, cron_expression, reviewers, status, created_by::text as created_by, created_at, updated_at"
	auditExecutionColumns   = "id, plan_id, tenant_id, status, started_at, completed_at, findings_count, created_at"
	auditFindingColumns     = "id, execution_id, tenant_id, title, description, severity, category, evidence, recommendation, status, assigned_to, closed_at, created_at"
	compliancePolicyColumns = "id, tenant_id, name, description, framework_type, requirements, rules, severity_threshold, enabled, created_by::text as created_by, created_at, updated_at"
	evaluationColumns       = "id, tenant_id, policy_id, status, score, total_checks, passed_checks, failed_checks, gaps, started_at, completed_at, created_at"
	sbomColumns             = "id, tenant_id, artifact_id, pipeline_id, sbom_format, sbom_version, components, dependencies, vulnerabilities, metadata, created_at"
	dependencyGraphColumns  = "id, tenant_id, package_name, package_version, direct_deps, transitive_deps, vulnerable_paths, depth, analyzed_at"
	poisoningScanColumns    = "id, tenant_id, packages_scanned, malicious_found, typosquatting_found, risk_score, risk_level, scan_data, created_at"
)

// Repository provides data access for all security domain entities.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// getOne runs a single-row SELECT and turns the driver's sql.ErrNoRows into
// sentinel.NotFound. The service layer switches on its own ErrXxxNotFound
// sentinels and the handlers on service.IsNotFound to answer 404, and both only
// recognise these wrapped errors. These readers used to return the raw driver
// error, so a missing id answered 500 with "sql: no rows" instead of 404 and
// every 404 branch in the handler files was dead code.
func (r *Repository) getOne(ctx context.Context, dest any, query string, args ...any) error {
	err := r.db.GetContext(ctx, dest, query, args...)
	if errors.Is(err, sql.ErrNoRows) {
		return sentinel.NotFound
	}
	return err
}

// oneRow turns an UPDATE or DELETE that matched nothing into the same sentinel.
// Without the RowsAffected check these writes reported success for ids that had
// already been deleted or that belonged to a different tenant, so the handler
// answered 200 for a delete of a row that did not exist and the service answered
// "updated" with a payload it then could not read back.
func (r *Repository) oneRow(res sql.Result, id string) error {
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("security %s: %w", id, sentinel.NotFound)
	}
	return nil
}

// ==================== Security Scans ====================

func (r *Repository) CreateScan(ctx context.Context, d *models.SecurityScan) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO security_scans
			(id, tenant_id, scan_type, target, scanner, status,
			 critical_count, high_count, medium_count, low_count, total_count,
			 passed, gate_failed, scan_start_time, scan_end_time, duration_ms, result)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
		d.ID, d.TenantID, d.ScanType, d.Target, d.Scanner, d.Status,
		d.CriticalCount, d.HighCount, d.MediumCount, d.LowCount, d.TotalCount,
		d.Passed, d.GateFailed, d.ScanStartTime, d.ScanEndTime, d.DurationMs, d.Result,
	)
	return err
}

// UpdateScan persists the fields a finished scanner writes back. The service used
// to mutate its in-memory copy and hand it back without touching the row, so the
// endpoint answered with a scan whose database record was still "pending".
func (r *Repository) UpdateScan(ctx context.Context, tenantID string, d *models.SecurityScan) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE security_scans
		 SET status=$1, critical_count=$2, high_count=$3, medium_count=$4, low_count=$5,
		     total_count=$6, passed=$7, gate_failed=$8,
		     scan_start_time=$9, scan_end_time=$10, duration_ms=$11, result=$12
		 WHERE id=$13 AND tenant_id=$14`,
		d.Status, d.CriticalCount, d.HighCount, d.MediumCount, d.LowCount,
		d.TotalCount, d.Passed, d.GateFailed,
		d.ScanStartTime, d.ScanEndTime, d.DurationMs, d.Result,
		d.ID, tenantID)
	if err != nil {
		return err
	}
	return r.oneRow(res, d.ID)
}

func (r *Repository) ListScans(ctx context.Context, tenantID string, offset, limit int) ([]models.SecurityScan, error) {
	var items []models.SecurityScan
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT %s FROM security_scans WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, scanColumns),
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetScanByID(ctx context.Context, tenantID, id string) (*models.SecurityScan, error) {
	var d models.SecurityScan
	if err := r.getOne(ctx, &d,
		fmt.Sprintf(`SELECT %s FROM security_scans WHERE id=$1 AND tenant_id=$2`, scanColumns), id, tenantID); err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) DeleteScan(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM security_scans WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
}

func (r *Repository) CountScans(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM security_scans WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ==================== Security Findings ====================

// IsValidSeverity checks that a severity string is one of the known allowed
// values. The whitelist is what makes it safe to interpolate nothing: callers
// pass an unrecognised value as a parameter only after this says yes, and the
// service rejects anything else before it reaches SQL.
func IsValidSeverity(severity string) bool {
	switch severity {
	case "critical", "high", "medium", "low", "info":
		return true
	}
	return false
}

func (r *Repository) CreateFinding(ctx context.Context, d *models.SecurityFinding) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO security_findings
			(id, tenant_id, scan_id, rule_id, severity, category, title, description,
			 file_path, line_start, line_end, code_snippet, match_text, confidence,
			 remediation, status, assigned_to, closed_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
		d.ID, d.TenantID, d.ScanID, d.RuleID, d.Severity, d.Category, d.Title,
		d.Description, d.FilePath, d.LineStart, d.LineEnd, d.CodeSnippet, d.MatchText,
		d.Confidence, d.Remediation, d.Status, d.AssignedTo, d.ClosedAt,
	)
	return err
}

func (r *Repository) BatchCreateFindings(ctx context.Context, findings []models.SecurityFinding) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx,
		`INSERT INTO security_findings
			(id, tenant_id, scan_id, rule_id, severity, category, title, description,
			 file_path, line_start, line_end, code_snippet, match_text, confidence,
			 remediation, status)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, f := range findings {
		if _, err := stmt.ExecContext(ctx,
			f.ID, f.TenantID, f.ScanID, f.RuleID, f.Severity, f.Category, f.Title,
			f.Description, f.FilePath, f.LineStart, f.LineEnd, f.CodeSnippet, f.MatchText,
			f.Confidence, f.Remediation, f.Status,
		); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// ListFindings rejects an unrecognised severity instead of returning an empty
// list. The previous code answered `items, nil` for a typo in the filter, so the
// API said "you have no findings" when the caller had asked for a severity that
// does not exist -- the empty list was indistinguishable from a genuinely empty
// scan, and the filter looked silently ignored.
func (r *Repository) ListFindings(ctx context.Context, tenantID string, offset, limit int, severity string) ([]models.SecurityFinding, error) {
	if severity != "" && !IsValidSeverity(severity) {
		return nil, fmt.Errorf("unsupported severity %q: want one of critical, high, medium, low, info", severity)
	}
	var items []models.SecurityFinding
	query := fmt.Sprintf(`SELECT %s FROM security_findings WHERE tenant_id=$1`, findingColumns)
	args := []interface{}{tenantID}

	if severity != "" {
		query += ` AND severity=$2 ORDER BY created_at DESC OFFSET $3 LIMIT $4`
		args = append(args, severity, offset, limit)
	} else {
		query += ` ORDER BY created_at DESC OFFSET $2 LIMIT $3`
		args = append(args, offset, limit)
	}

	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) GetFindingByID(ctx context.Context, tenantID, id string) (*models.SecurityFinding, error) {
	var d models.SecurityFinding
	if err := r.getOne(ctx, &d,
		fmt.Sprintf(`SELECT %s FROM security_findings WHERE id=$1 AND tenant_id=$2`, findingColumns), id, tenantID); err != nil {
		return nil, err
	}
	return &d, nil
}

// FindingsByScanID is what GET /findings/scan/:scan_id serves. The scan id
// arrives from the URL, so the tenant is part of the predicate: without it a
// caller who learned any scan id could list that tenant's findings.
func (r *Repository) FindingsByScanID(ctx context.Context, tenantID, scanID string) ([]models.SecurityFinding, error) {
	var items []models.SecurityFinding
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT %s FROM security_findings WHERE tenant_id=$1 AND scan_id=$2 ORDER BY severity, created_at`, findingColumns),
		tenantID, scanID)
	return items, err
}

func (r *Repository) CountFindings(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM security_findings WHERE tenant_id=$1`, tenantID)
	return count, err
}

func (r *Repository) UpdateFinding(ctx context.Context, tenantID, id string, req *models.UpdateFindingRequest) (*models.SecurityFinding, error) {
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if req.Status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status=$%d", argIdx))
		args = append(args, *req.Status)
		argIdx++
		if *req.Status == "closed" {
			setClauses = append(setClauses, "closed_at=NOW()")
		}
	}
	if req.AssignedTo != nil {
		setClauses = append(setClauses, fmt.Sprintf("assigned_to=$%d", argIdx))
		args = append(args, *req.AssignedTo)
		argIdx++
	}
	if req.Recommendation != nil {
		setClauses = append(setClauses, fmt.Sprintf("remediation=$%d", argIdx))
		args = append(args, *req.Recommendation)
		argIdx++
	}

	if len(setClauses) == 0 {
		return r.GetFindingByID(ctx, tenantID, id)
	}

	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE security_findings SET %s WHERE id=$%d AND tenant_id=$%d",
		strings.Join(setClauses, ", "), argIdx, argIdx+1)

	res, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	if err := r.oneRow(res, id); err != nil {
		return nil, err
	}
	return r.GetFindingByID(ctx, tenantID, id)
}

// ==================== Audit Plans ====================

func (r *Repository) CreateAuditPlan(ctx context.Context, d *models.AuditPlan) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO audit_plans
			(id, tenant_id, name, description, scope, audit_type, schedule_type,
			 cron_expression, reviewers, status, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		d.ID, d.TenantID, d.Name, d.Description, d.Scope, d.AuditType,
		d.ScheduleType, d.CronExpression, d.Reviewers, d.Status, d.CreatedBy,
	)
	return err
}

func (r *Repository) ListAuditPlans(ctx context.Context, tenantID string) ([]models.AuditPlan, error) {
	var items []models.AuditPlan
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT %s FROM audit_plans WHERE tenant_id=$1 ORDER BY created_at DESC`, auditPlanColumns), tenantID)
	return items, err
}

func (r *Repository) GetAuditPlanByID(ctx context.Context, tenantID, id string) (*models.AuditPlan, error) {
	var d models.AuditPlan
	if err := r.getOne(ctx, &d,
		fmt.Sprintf(`SELECT %s FROM audit_plans WHERE id=$1 AND tenant_id=$2`, auditPlanColumns), id, tenantID); err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) UpdateAuditPlan(ctx context.Context, tenantID, id string, req *models.UpdateAuditPlanRequest) (*models.AuditPlan, error) {
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name=$%d", argIdx))
		args = append(args, *req.Name)
		argIdx++
	}
	if req.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description=$%d", argIdx))
		args = append(args, *req.Description)
		argIdx++
	}
	if req.AuditType != nil {
		setClauses = append(setClauses, fmt.Sprintf("audit_type=$%d", argIdx))
		args = append(args, *req.AuditType)
		argIdx++
	}
	if req.ScheduleType != nil {
		setClauses = append(setClauses, fmt.Sprintf("schedule_type=$%d", argIdx))
		args = append(args, *req.ScheduleType)
		argIdx++
	}
	if req.Scope != nil {
		scopeJSON, _ := json.Marshal(req.Scope)
		setClauses = append(setClauses, fmt.Sprintf("scope=$%d", argIdx))
		args = append(args, scopeJSON)
		argIdx++
	}

	if len(setClauses) == 0 {
		return r.GetAuditPlanByID(ctx, tenantID, id)
	}

	setClauses = append(setClauses, "updated_at=NOW()")
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE audit_plans SET %s WHERE id=$%d AND tenant_id=$%d",
		strings.Join(setClauses, ", "), argIdx, argIdx+1)

	res, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	if err := r.oneRow(res, id); err != nil {
		return nil, err
	}
	return r.GetAuditPlanByID(ctx, tenantID, id)
}

func (r *Repository) UpdateAuditPlanStatus(ctx context.Context, tenantID, id, status string) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE audit_plans SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		status, id, tenantID)
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
}

func (r *Repository) DeleteAuditPlan(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM audit_plans WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
}

// ==================== Audit Executions ====================

func (r *Repository) CreateAuditExecution(ctx context.Context, d *models.AuditExecution) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO audit_executions (id, plan_id, tenant_id, status, started_at, findings_count)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		d.ID, d.PlanID, d.TenantID, d.Status, d.StartedAt, d.FindingsCount,
	)
	return err
}

func (r *Repository) UpdateAuditExecution(ctx context.Context, tenantID, id, status string, findingsCount int) (*models.AuditExecution, error) {
	res, err := r.db.ExecContext(ctx,
		`UPDATE audit_executions SET status=$1, findings_count=$2, completed_at=NOW() WHERE id=$3 AND tenant_id=$4`,
		status, findingsCount, id, tenantID)
	if err != nil {
		return nil, err
	}
	if err := r.oneRow(res, id); err != nil {
		return nil, err
	}
	var d models.AuditExecution
	if err := r.getOne(ctx, &d,
		fmt.Sprintf(`SELECT %s FROM audit_executions WHERE id=$1 AND tenant_id=$2`, auditExecutionColumns),
		id, tenantID); err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) GetAuditExecutionByID(ctx context.Context, tenantID, id string) (*models.AuditExecution, error) {
	var d models.AuditExecution
	if err := r.getOne(ctx, &d,
		fmt.Sprintf(`SELECT %s FROM audit_executions WHERE id=$1 AND tenant_id=$2`, auditExecutionColumns), id, tenantID); err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) ListAuditExecutions(ctx context.Context, tenantID, planID string) ([]models.AuditExecution, error) {
	var items []models.AuditExecution
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT %s FROM audit_executions WHERE tenant_id=$1 AND plan_id=$2 ORDER BY created_at DESC`, auditExecutionColumns),
		tenantID, planID)
	return items, err
}

func (r *Repository) FindLatestExecutionByPlan(ctx context.Context, tenantID, planID string) (*models.AuditExecution, error) {
	var d models.AuditExecution
	if err := r.getOne(ctx, &d,
		fmt.Sprintf(`SELECT %s FROM audit_executions WHERE tenant_id=$1 AND plan_id=$2 ORDER BY created_at DESC LIMIT 1`, auditExecutionColumns),
		tenantID, planID); err != nil {
		return nil, err
	}
	return &d, nil
}

// ==================== Audit Findings ====================

func (r *Repository) CreateAuditFinding(ctx context.Context, d *models.AuditFinding) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO audit_findings
			(id, execution_id, tenant_id, title, description, severity, category,
			 evidence, recommendation, status, assigned_to, closed_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		d.ID, d.ExecutionID, d.TenantID, d.Title, d.Description, d.Severity,
		d.Category, d.Evidence, d.Recommendation, d.Status, d.AssignedTo, d.ClosedAt,
	)
	return err
}

func (r *Repository) ListAuditFindings(ctx context.Context, tenantID, executionID string) ([]models.AuditFinding, error) {
	var items []models.AuditFinding
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT %s FROM audit_findings WHERE tenant_id=$1 AND execution_id=$2 ORDER BY severity, created_at`, auditFindingColumns),
		tenantID, executionID)
	return items, err
}

func (r *Repository) GetAuditFindingByID(ctx context.Context, tenantID, id string) (*models.AuditFinding, error) {
	var d models.AuditFinding
	if err := r.getOne(ctx, &d,
		fmt.Sprintf(`SELECT %s FROM audit_findings WHERE id=$1 AND tenant_id=$2`, auditFindingColumns), id, tenantID); err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) UpdateAuditFinding(ctx context.Context, tenantID, id string, req *models.UpdateFindingRequest) (*models.AuditFinding, error) {
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if req.Status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status=$%d", argIdx))
		args = append(args, *req.Status)
		argIdx++
		if *req.Status == "closed" {
			setClauses = append(setClauses, "closed_at=NOW()")
		}
	}
	if req.AssignedTo != nil {
		setClauses = append(setClauses, fmt.Sprintf("assigned_to=$%d", argIdx))
		args = append(args, *req.AssignedTo)
		argIdx++
	}
	if req.Recommendation != nil {
		setClauses = append(setClauses, fmt.Sprintf("recommendation=$%d", argIdx))
		args = append(args, *req.Recommendation)
		argIdx++
	}

	if len(setClauses) == 0 {
		return r.GetAuditFindingByID(ctx, tenantID, id)
	}

	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE audit_findings SET %s WHERE id=$%d AND tenant_id=$%d",
		strings.Join(setClauses, ", "), argIdx, argIdx+1)

	res, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	if err := r.oneRow(res, id); err != nil {
		return nil, err
	}
	return r.GetAuditFindingByID(ctx, tenantID, id)
}

func (r *Repository) CountAuditFindingsByExecution(ctx context.Context, tenantID, executionID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM audit_findings WHERE tenant_id=$1 AND execution_id=$2`, tenantID, executionID)
	return count, err
}

// ==================== Compliance Policies ====================

func (r *Repository) CreateCompliancePolicy(ctx context.Context, d *models.CompliancePolicy) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO compliance_policies
			(id, tenant_id, name, description, framework_type, requirements, rules,
			 severity_threshold, enabled, created_by)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		d.ID, d.TenantID, d.Name, d.Description, d.FrameworkType, d.Requirements,
		d.Rules, d.SeverityThreshold, d.Enabled, d.CreatedBy,
	)
	return err
}

func (r *Repository) ListCompliancePolicies(ctx context.Context, tenantID, frameworkType string) ([]models.CompliancePolicy, error) {
	var items []models.CompliancePolicy
	if frameworkType != "" {
		err := r.db.SelectContext(ctx, &items,
			fmt.Sprintf(`SELECT %s FROM compliance_policies WHERE tenant_id=$1 AND framework_type=$2 ORDER BY created_at DESC`, compliancePolicyColumns),
			tenantID, frameworkType)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT %s FROM compliance_policies WHERE tenant_id=$1 ORDER BY created_at DESC`, compliancePolicyColumns),
		tenantID)
	return items, err
}

func (r *Repository) GetCompliancePolicyByID(ctx context.Context, tenantID, id string) (*models.CompliancePolicy, error) {
	var d models.CompliancePolicy
	if err := r.getOne(ctx, &d,
		fmt.Sprintf(`SELECT %s FROM compliance_policies WHERE id=$1 AND tenant_id=$2`, compliancePolicyColumns), id, tenantID); err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) DeleteCompliancePolicy(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM compliance_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	return r.oneRow(res, id)
}

// ==================== Compliance Evaluations ====================

func (r *Repository) CreateComplianceEvaluation(ctx context.Context, d *models.ComplianceEvaluation) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO compliance_evaluations
			(id, tenant_id, policy_id, status, score, total_checks, passed_checks,
			 failed_checks, gaps, started_at, completed_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
		d.ID, d.TenantID, d.PolicyID, d.Status, d.Score, d.TotalChecks,
		d.PassedChecks, d.FailedChecks, d.Gaps, d.StartedAt, d.CompletedAt,
	)
	return err
}

func (r *Repository) UpdateComplianceEvaluation(ctx context.Context, tenantID, id, status string, score float32, totalChecks, passedChecks, failedChecks int, gaps []models.ComplianceGap) (*models.ComplianceEvaluation, error) {
	gapsJSON, _ := json.Marshal(gaps)
	res, err := r.db.ExecContext(ctx,
		`UPDATE compliance_evaluations
		 SET status=$1, score=$2, total_checks=$3, passed_checks=$4, failed_checks=$5, gaps=$6, completed_at=NOW()
		 WHERE id=$7 AND tenant_id=$8`,
		status, score, totalChecks, passedChecks, failedChecks, gapsJSON, id, tenantID)
	if err != nil {
		return nil, err
	}
	if err := r.oneRow(res, id); err != nil {
		return nil, err
	}
	var d models.ComplianceEvaluation
	if err := r.getOne(ctx, &d,
		fmt.Sprintf(`SELECT %s FROM compliance_evaluations WHERE id=$1 AND tenant_id=$2`, evaluationColumns),
		id, tenantID); err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) FindLatestEvaluationByPolicy(ctx context.Context, tenantID, policyID string) (*models.ComplianceEvaluation, error) {
	var d models.ComplianceEvaluation
	if err := r.getOne(ctx, &d,
		fmt.Sprintf(`SELECT %s FROM compliance_evaluations WHERE tenant_id=$1 AND policy_id=$2 ORDER BY created_at DESC LIMIT 1`, evaluationColumns),
		tenantID, policyID); err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) ListComplianceEvaluationsByTenant(ctx context.Context, tenantID string) ([]models.ComplianceEvaluation, error) {
	var items []models.ComplianceEvaluation
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT %s FROM compliance_evaluations WHERE tenant_id=$1 ORDER BY created_at DESC`, evaluationColumns),
		tenantID)
	return items, err
}

// ==================== Supply Chain SBOMs ====================

func (r *Repository) CreateSBOM(ctx context.Context, d *models.SupplyChainSBOM) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO supply_chain_sboms
			(id, tenant_id, artifact_id, pipeline_id, sbom_format, sbom_version,
			 components, dependencies, vulnerabilities, metadata)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
		d.ID, d.TenantID, d.ArtifactID, d.PipelineID, d.SBOMFormat, d.SBOMVersion,
		d.Components, d.Dependencies, d.Vulnerabilities, d.Metadata,
	)
	return err
}

func (r *Repository) GetSBOMByID(ctx context.Context, tenantID, id string) (*models.SupplyChainSBOM, error) {
	var d models.SupplyChainSBOM
	if err := r.getOne(ctx, &d,
		fmt.Sprintf(`SELECT %s FROM supply_chain_sboms WHERE id=$1 AND tenant_id=$2`, sbomColumns), id, tenantID); err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) ListSBOMs(ctx context.Context, tenantID string, offset, limit int) ([]models.SupplyChainSBOM, error) {
	var items []models.SupplyChainSBOM
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT %s FROM supply_chain_sboms WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, sbomColumns),
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) CountSBOMs(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM supply_chain_sboms WHERE tenant_id=$1`, tenantID)
	return count, err
}

func (r *Repository) SumSBOMVulnerabilities(ctx context.Context, tenantID string) (int, error) {
	var total *int
	err := r.db.GetContext(ctx, &total,
		`SELECT COALESCE(SUM(jsonb_array_length(vulnerabilities)), 0) FROM supply_chain_sboms WHERE tenant_id=$1`, tenantID)
	if err != nil || total == nil {
		return 0, err
	}
	return *total, nil
}

// ==================== Dependency Graphs ====================

func (r *Repository) FindDependencyGraph(ctx context.Context, tenantID, packageName, packageVersion string) (*models.DependencyGraph, error) {
	var d models.DependencyGraph
	if err := r.getOne(ctx, &d,
		fmt.Sprintf(`SELECT %s FROM dependency_graphs WHERE tenant_id=$1 AND package_name=$2 AND package_version=$3`, dependencyGraphColumns),
		tenantID, packageName, packageVersion); err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) CreateDependencyGraph(ctx context.Context, d *models.DependencyGraph) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO dependency_graphs
			(id, tenant_id, package_name, package_version, direct_deps,
			 transitive_deps, vulnerable_paths, depth)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		d.ID, d.TenantID, d.PackageName, d.PackageVersion, d.DirectDeps,
		d.TransitiveDeps, d.VulnerablePaths, d.Depth,
	)
	return err
}

func (r *Repository) ListDependencyGraphs(ctx context.Context, tenantID string, offset, limit int) ([]models.DependencyGraph, error) {
	var items []models.DependencyGraph
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT %s FROM dependency_graphs WHERE tenant_id=$1 ORDER BY analyzed_at DESC OFFSET $2 LIMIT $3`, dependencyGraphColumns),
		tenantID, offset, limit)
	return items, err
}

// ==================== Dependency Poisoning Scans ====================

func (r *Repository) CreateDependencyPoisoningScan(ctx context.Context, d *models.DependencyPoisoningScan) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO dependency_poisoning_scans
			(id, tenant_id, packages_scanned, malicious_found, typosquatting_found,
			 risk_score, risk_level, scan_data)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		d.ID, d.TenantID, d.PackagesScanned, d.MaliciousFound, d.TyposquattingFound,
		d.RiskScore, d.RiskLevel, d.ScanData,
	)
	return err
}

func (r *Repository) ListDependencyPoisoningScans(ctx context.Context, tenantID string, offset, limit int) ([]models.DependencyPoisoningScan, error) {
	var items []models.DependencyPoisoningScan
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT %s FROM dependency_poisoning_scans WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`, poisoningScanColumns),
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) CountDependencyPoisoningScans(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM dependency_poisoning_scans WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ==================== Utility ====================

// ClampFloat32 clamps a float32 value to a range. Compliance scores are
// percentages, so an evaluation that finds more than ten gaps used to return a
// negative score, which the dashboard rendered as "0%" and hid as fully
// compliant.
func ClampFloat32(val, minVal, maxVal float32) float32 {
	return float32(math.Min(float64(maxVal), math.Max(float64(minVal), float64(val))))
}
