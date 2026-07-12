package repository

import (
	"context"
	"time"

	"orion/platform-svc-go/internal/security-compliance/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Compliance Policy ---

func (r *Repository) CreatePolicy(ctx context.Context, p *models.CompliancePolicy) error {
	p.ID = uuid.New().String()
	p.Status = "active"
	p.CreatedAt = time.Now().UTC()
	p.UpdatedAt = time.Now().UTC()
	query := `INSERT INTO compliance_policies (id, tenant_id, name, framework, rules, status, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :framework, :rules, :status, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, p)
	return err
}

func (r *Repository) GetPolicy(ctx context.Context, tenantID, id string) (*models.CompliancePolicy, error) {
	var p models.CompliancePolicy
	err := r.db.GetContext(ctx, &p,
		`SELECT * FROM compliance_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) ListPolicies(ctx context.Context, tenantID string, limit, offset int) ([]models.CompliancePolicy, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.CompliancePolicy
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM compliance_policies WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// --- Compliance Evaluation ---

func (r *Repository) InsertEvaluation(ctx context.Context, tenantID string, result *models.ComplianceEvaluationResult) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO compliance_evaluation_results (id, tenant_id, policy_id, status, score, failures, warnings, evaluated_at)
			VALUES (:id, :tenant_id, :policy_id, :status, :score, :failures, :warnings, :evaluated_at)`,
		map[string]interface{}{
			"id":           uuid.New().String(),
			"tenant_id":    tenantID,
			"policy_id":    result.PolicyID,
			"status":       result.Status,
			"score":        result.Score,
			"failures":     joinStrings(result.Failures),
			"warnings":     joinStrings(result.Warnings),
			"evaluated_at": result.EvaluatedAt,
		})
	return err
}

// --- Compliance Report ---

func (r *Repository) CreateReport(ctx context.Context, report *models.ComplianceReport) error {
	report.ID = uuid.New().String()
	report.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO compliance_reports (id, tenant_id, policy_id, status, score, failures, created_at)
			VALUES (:id, :tenant_id, :policy_id, :status, :score, :failures, :created_at)`, report)
	return err
}

func (r *Repository) GetReportByPolicy(ctx context.Context, tenantID, policyID string) (*models.ComplianceReport, error) {
	var report models.ComplianceReport
	err := r.db.GetContext(ctx, &report,
		`SELECT * FROM compliance_reports WHERE policy_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 1`, policyID, tenantID)
	if err != nil {
		return nil, err
	}
	return &report, nil
}

// --- Compliance Score ---

func (r *Repository) GetLatestScore(ctx context.Context, tenantID string) (*models.ComplianceScore, error) {
	var score models.ComplianceScore
	err := r.db.GetContext(ctx, &score,
		`SELECT score as overall_score, category_scores, trend, last_updated
			FROM compliance_scores WHERE tenant_id=$1 ORDER BY last_updated DESC LIMIT 1`, tenantID)
	if err != nil {
		return nil, err
	}
	return &score, nil
}

func (r *Repository) UpsertScore(ctx context.Context, tenantID string, score *models.ComplianceScore) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO compliance_scores (id, tenant_id, overall_score, category_scores, trend, last_updated)
			VALUES (:id, :tenant_id, :overall_score, :category_scores, :trend, :last_updated)
			ON CONFLICT (tenant_id) DO UPDATE SET overall_score=EXCLUDED.overall_score, category_scores=EXCLUDED.category_scores, trend=EXCLUDED.trend, last_updated=EXCLUDED.last_updated`,
		map[string]interface{}{
			"id":               uuid.New().String(),
			"tenant_id":        tenantID,
			"overall_score":    score.OverallScore,
			"category_scores":  joinStringsForMap(score.CategoryScores),
			"trend":            score.Trend,
			"last_updated":     score.LastUpdated,
		})
	return err
}

// --- Audit Plan ---

func (r *Repository) CreateAuditPlan(ctx context.Context, plan *models.AuditPlan) error {
	plan.ID = uuid.New().String()
	plan.Status = "scheduled"
	plan.CreatedAt = time.Now().UTC()
	plan.UpdatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO audit_plans (id, tenant_id, name, description, schedule, status, created_at, updated_at)
			VALUES (:id, :tenant_id, :name, :description, :schedule, :status, :created_at, :updated_at)`, plan)
	return err
}

func (r *Repository) ListAuditPlans(ctx context.Context, tenantID string, limit, offset int) ([]models.AuditPlan, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.AuditPlan
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM audit_plans WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// --- Audit Execution ---

func (r *Repository) CreateAuditExecution(ctx context.Context, exec *models.AuditExecution) error {
	exec.ID = uuid.New().String()
	exec.StartedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO audit_executions (id, plan_id, tenant_id, status, result, started_at, ended_at)
			VALUES (:id, :plan_id, :tenant_id, :status, :result, :started_at, :ended_at)`, exec)
	return err
}

func (r *Repository) UpdateAuditExecution(ctx context.Context, tenantID, id string, status, result string, endedAt *time.Time) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE audit_executions SET status=$1, result=$2, ended_at=$3 WHERE id=$4 AND tenant_id=$5`,
		status, result, endedAt, id, tenantID)
	return err
}

// --- Audit Report ---

func (r *Repository) CreateAuditReport(ctx context.Context, report *models.AuditReport) error {
	report.ID = uuid.New().String()
	report.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO audit_reports (id, execution_id, tenant_id, summary, findings_count, created_at)
			VALUES (:id, :execution_id, :tenant_id, :summary, :findings_count, :created_at)`, report)
	return err
}

func (r *Repository) GetAuditReport(ctx context.Context, tenantID, executionID string) (*models.AuditReport, error) {
	var report models.AuditReport
	err := r.db.GetContext(ctx, &report,
		`SELECT * FROM audit_reports WHERE execution_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 1`, executionID, tenantID)
	if err != nil {
		return nil, err
	}
	return &report, nil
}

// --- Audit Finding ---

func (r *Repository) GetAuditFindings(ctx context.Context, tenantID, reportID string) ([]models.AuditFinding, error) {
	var items []models.AuditFinding
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM audit_findings WHERE report_id=$1 AND tenant_id=$2 ORDER BY severity, created_at DESC`, reportID, tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CloseFinding(ctx context.Context, tenantID, id string, reason string) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE audit_findings SET status='closed', closed_at=$1 WHERE id=$2 AND tenant_id=$3`,
		now, id, tenantID)
	return err
}

// --- Compliance Framework ---

func (r *Repository) ListFrameworks(ctx context.Context, tenantID string) ([]models.ComplianceFramework, error) {
	var items []models.ComplianceFramework
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM compliance_frameworks WHERE tenant_id=$1 ORDER BY name`, tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) GetFramework(ctx context.Context, tenantID, id string) (*models.ComplianceFramework, error) {
	var f models.ComplianceFramework
	err := r.db.GetContext(ctx, &f,
		`SELECT * FROM compliance_frameworks WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

// --- Evidence ---

func (r *Repository) CollectEvidence(ctx context.Context, evidence *models.Evidence) error {
	evidence.ID = uuid.New().String()
	evidence.Status = "collected"
	evidence.CollectedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO compliance_evidence (id, tenant_id, policy_id, source, data, status, collected_at)
			VALUES (:id, :tenant_id, :policy_id, :source, :data, :status, :collected_at)`, evidence)
	return err
}

func (r *Repository) GetEvidence(ctx context.Context, tenantID, policyID string) ([]models.Evidence, error) {
	var items []models.Evidence
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM compliance_evidence WHERE policy_id=$1 AND tenant_id=$2 ORDER BY collected_at DESC`, policyID, tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// --- Gap Analysis ---

func (r *Repository) InsertGapAnalysis(ctx context.Context, tenantID string, result *models.GapAnalysisResult) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO gap_analysis_results (id, tenant_id, framework, total_controls, implemented, partial, not_implemented, gaps)
			VALUES (:id, :tenant_id, :framework, :total_controls, :implemented, :partial, :not_implemented, :gaps)`,
		map[string]interface{}{
			"id":             uuid.New().String(),
			"tenant_id":      tenantID,
			"framework":      result.Framework,
			"total_controls": result.TotalControls,
			"implemented":    result.Implemented,
			"partial":        result.Partial,
			"not_implemented": result.NotImplemented,
			"gaps":           joinGaps(result.Gaps),
		})
	return err
}

// --- Helpers ---

func joinStrings(strs []string) string {
	if len(strs) == 0 {
		return ""
	}
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += ","
		}
		result += s
	}
	return result
}

func joinStringsForMap(m map[string]float64) string {
	// TODO: marshal to JSON string properly
	return ""
}

func joinGaps(gaps []models.GapAnalysisItem) string {
	// TODO: marshal to JSON string properly
	return ""
}
