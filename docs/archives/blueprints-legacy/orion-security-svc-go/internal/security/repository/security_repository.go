package repository

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"orion/security-svc-go/internal/security/models"

	"github.com/jmoiron/sqlx"
)

// Repository provides data access for all security domain entities.
type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
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

func (r *Repository) ListScans(ctx context.Context, tenantID string, offset, limit int) ([]models.SecurityScan, error) {
	var items []models.SecurityScan
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM security_scans WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) GetScanByID(ctx context.Context, tenantID, id string) (*models.SecurityScan, error) {
	var d models.SecurityScan
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM security_scans WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) DeleteScan(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM security_scans WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) CountScans(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM security_scans WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ==================== Security Findings ====================

// isValidSeverity checks that a severity string is one of the known allowed values.
// This whitelist prevents SQL injection when severity is used in dynamic SQL.
func isValidSeverity(severity string) bool {
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

func (r *Repository) ListFindings(ctx context.Context, tenantID string, offset, limit int, severity string) ([]models.SecurityFinding, error) {
	var items []models.SecurityFinding
	query := `SELECT * FROM security_findings WHERE tenant_id=$1`
	args := []interface{}{tenantID}

	if severity != "" {
		// Whitelist validation prevents SQL injection on user-supplied severity.
		if !isValidSeverity(severity) {
			return items, nil // silently ignore unrecognised filter value
		}
		query = `SELECT * FROM security_findings WHERE tenant_id=$1 AND severity=$2 ORDER BY created_at DESC OFFSET $3 LIMIT $4`
		args = append(args, severity, offset, limit)
	} else {
		query += " ORDER BY created_at DESC OFFSET $2 LIMIT $3"
		args = append(args, offset, limit)
	}

	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) GetFindingByID(ctx context.Context, tenantID, id string) (*models.SecurityFinding, error) {
	var d models.SecurityFinding
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM security_findings WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) FindingsByScanID(ctx context.Context, scanID string) ([]models.SecurityFinding, error) {
	var items []models.SecurityFinding
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM security_findings WHERE scan_id=$1 ORDER BY severity, created_at`, scanID)
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
			setClauses = append(setClauses, fmt.Sprintf("closed_at=NOW()"))
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

	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
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
		`SELECT * FROM audit_plans WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) GetAuditPlanByID(ctx context.Context, tenantID, id string) (*models.AuditPlan, error) {
	var d models.AuditPlan
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM audit_plans WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
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

	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetAuditPlanByID(ctx, tenantID, id)
}

func (r *Repository) UpdateAuditPlanStatus(ctx context.Context, id, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE audit_plans SET status=$1, updated_at=NOW() WHERE id=$2`, status, id)
	return err
}

func (r *Repository) DeleteAuditPlan(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM audit_plans WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
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

func (r *Repository) UpdateAuditExecution(ctx context.Context, id, status string, findingsCount int) (*models.AuditExecution, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE audit_executions SET status=$1, findings_count=$2, completed_at=NOW() WHERE id=$3`,
		status, findingsCount, id)
	if err != nil {
		return nil, err
	}
	var d models.AuditExecution
	err = r.db.GetContext(ctx, &d, `SELECT * FROM audit_executions WHERE id=$1`, id)
	return &d, err
}

func (r *Repository) GetAuditExecutionByID(ctx context.Context, id string) (*models.AuditExecution, error) {
	var d models.AuditExecution
	err := r.db.GetContext(ctx, &d, `SELECT * FROM audit_executions WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) ListAuditExecutions(ctx context.Context, planID string) ([]models.AuditExecution, error) {
	var items []models.AuditExecution
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM audit_executions WHERE plan_id=$1 ORDER BY created_at DESC`, planID)
	return items, err
}

func (r *Repository) FindLatestExecutionByPlan(ctx context.Context, planID string) (*models.AuditExecution, error) {
	var d models.AuditExecution
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM audit_executions WHERE plan_id=$1 ORDER BY created_at DESC LIMIT 1`, planID)
	if err != nil {
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

func (r *Repository) ListAuditFindings(ctx context.Context, executionID string) ([]models.AuditFinding, error) {
	var items []models.AuditFinding
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM audit_findings WHERE execution_id=$1 ORDER BY severity, created_at`, executionID)
	return items, err
}

func (r *Repository) GetAuditFindingByID(ctx context.Context, tenantID, id string) (*models.AuditFinding, error) {
	var d models.AuditFinding
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM audit_findings WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
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

	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetAuditFindingByID(ctx, tenantID, id)
}

func (r *Repository) CountAuditFindingsByExecution(ctx context.Context, executionID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM audit_findings WHERE execution_id=$1`, executionID)
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
			`SELECT * FROM compliance_policies WHERE tenant_id=$1 AND framework_type=$2 ORDER BY created_at DESC`,
			tenantID, frameworkType)
		return items, err
	}
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM compliance_policies WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) GetCompliancePolicyByID(ctx context.Context, id string) (*models.CompliancePolicy, error) {
	var d models.CompliancePolicy
	err := r.db.GetContext(ctx, &d, `SELECT * FROM compliance_policies WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) DeleteCompliancePolicy(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM compliance_policies WHERE id=$1`, id)
	return err
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

func (r *Repository) UpdateComplianceEvaluation(ctx context.Context, id string, status string, score float32, totalChecks, passedChecks, failedChecks int, gaps []models.ComplianceGap) (*models.ComplianceEvaluation, error) {
	gapsJSON, _ := json.Marshal(gaps)
	_, err := r.db.ExecContext(ctx,
		`UPDATE compliance_evaluations
		 SET status=$1, score=$2, total_checks=$3, passed_checks=$4, failed_checks=$5, gaps=$6, completed_at=NOW()
		 WHERE id=$7`,
		status, score, totalChecks, passedChecks, failedChecks, gapsJSON, id)
	if err != nil {
		return nil, err
	}
	var d models.ComplianceEvaluation
	err = r.db.GetContext(ctx, &d, `SELECT * FROM compliance_evaluations WHERE id=$1`, id)
	return &d, err
}

func (r *Repository) FindLatestEvaluationByPolicy(ctx context.Context, policyID string) (*models.ComplianceEvaluation, error) {
	var d models.ComplianceEvaluation
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM compliance_evaluations WHERE policy_id=$1 ORDER BY created_at DESC LIMIT 1`, policyID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) ListComplianceEvaluationsByTenant(ctx context.Context, tenantID string) ([]models.ComplianceEvaluation, error) {
	var items []models.ComplianceEvaluation
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM compliance_evaluations WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
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

func (r *Repository) GetSBOMByID(ctx context.Context, id string) (*models.SupplyChainSBOM, error) {
	var d models.SupplyChainSBOM
	err := r.db.GetContext(ctx, &d, `SELECT * FROM supply_chain_sboms WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) ListSBOMs(ctx context.Context, tenantID string, offset, limit int) ([]models.SupplyChainSBOM, error) {
	var items []models.SupplyChainSBOM
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM supply_chain_sboms WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
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
	err := r.db.GetContext(ctx, &d,
		`SELECT * FROM dependency_graphs WHERE tenant_id=$1 AND package_name=$2 AND package_version=$3`,
		tenantID, packageName, packageVersion)
	if err != nil {
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
		`SELECT * FROM dependency_graphs WHERE tenant_id=$1 ORDER BY analyzed_at DESC OFFSET $2 LIMIT $3`,
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
		`SELECT * FROM dependency_poisoning_scans WHERE tenant_id=$1 ORDER BY created_at DESC OFFSET $2 LIMIT $3`,
		tenantID, offset, limit)
	return items, err
}

func (r *Repository) CountDependencyPoisoningScans(ctx context.Context, tenantID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count,
		`SELECT COUNT(*) FROM dependency_poisoning_scans WHERE tenant_id=$1`, tenantID)
	return count, err
}

// ==================== Supply Chain Aggregates ====================

// SignatureCount returns (total, verified) counts from artifact_signatures table if it exists.
// Falls back to (0,0) if the table doesn't exist.
func (r *Repository) SignatureCount(ctx context.Context, tenantID string) (total, verified int, _ error) {
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM artifact_signatures WHERE tenant_id=$1`, tenantID)
	if err != nil {
		// Table may not exist in this service's schema
		return 0, 0, nil
	}
	err = r.db.GetContext(ctx, &verified,
		`SELECT COUNT(*) FROM artifact_signatures WHERE tenant_id=$1 AND verified=true`, tenantID)
	if err != nil {
		return total, 0, nil
	}
	return total, verified, nil
}

// PoisoningScanCounts returns (total, critical) counts.
func (r *Repository) PoisoningScanCounts(ctx context.Context, tenantID string) (total, critical int, _ error) {
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM dependency_poisoning_scans WHERE tenant_id=$1`, tenantID)
	if err != nil {
		return 0, 0, nil
	}
	err = r.db.GetContext(ctx, &critical,
		`SELECT COUNT(*) FROM dependency_poisoning_scans WHERE tenant_id=$1 AND risk_level IN ('high','critical')`, tenantID)
	if err != nil {
		return total, 0, nil
	}
	return total, critical, nil
}

// ==================== Utility ====================

// GenerateID creates a deterministic ID from prefix + content hash.
func GenerateID(prefix string, parts ...string) string {
	h := sha256.New()
	for _, p := range parts {
		h.Write([]byte(p))
	}
	return fmt.Sprintf("%s-%x", prefix, h.Sum(nil)[:8])
}

// ClampFloat32 clamps a float32 value to a range.
func ClampFloat32(val, minVal, maxVal float32) float32 {
	return float32(math.Min(float64(maxVal), math.Max(float64(minVal), float64(val))))
}
