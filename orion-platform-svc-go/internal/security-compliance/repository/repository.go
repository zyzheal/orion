package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/security-compliance/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// The models map fewer columns than their tables have: 066 created each table,
// then 571 added deleted_at and 572 added created_by / updated_by / updated_at,
// and 577 added audit_findings.resolution and audit_findings.target. sqlx
// scans in safe mode, so `SELECT *` into these structs failed on every row with
// "missing destination name <col> in <T>" — every read endpoint in the module
// answered 500 instead of data. Selecting the columns explicitly returns exactly
// the fields the models declare, so the extra columns are never handed to the
// scanner and no model change is needed for them.
const (
	policyColumns      = "id, tenant_id, name, framework, rules, status, created_at, updated_at"
	reportColumns      = "id, tenant_id, policy_id, name, description, framework, triggered_by, status, score, failures, created_at, updated_at"
	planColumns        = "id, tenant_id, name, description, schedule, status, created_at, updated_at"
	auditReportColumns = "id, execution_id, tenant_id, summary, findings_count, created_at"
	findingColumns     = "id, report_id, tenant_id, target, severity, title, description, status, resolution, closed_at, created_at"
	frameworkColumns   = "id, tenant_id, name, description, version, controls, created_at"
	evidenceColumns    = "id, tenant_id, policy_id, source, data, status, collected_at"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// getOne runs a single-row SELECT and turns sql.ErrNoRows into sentinel.NotFound
// so the service layer's IsNotFound branches and the handlers' 404 responses are
// reachable. Without the wrap every miss surfaced as a raw driver error and the
// endpoints reported 500 for rows that simply do not exist.
func (r *Repository) getOne(ctx context.Context, dest any, query string, args ...any) error {
	err := r.db.GetContext(ctx, dest, query, args...)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return sentinel.NotFound
		}
		return err
	}
	return nil
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
	if err := r.getOne(ctx, &p,
		fmt.Sprintf(`SELECT %s FROM compliance_policies WHERE id=$1 AND tenant_id=$2`, policyColumns), id, tenantID); err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) ListPolicies(ctx context.Context, tenantID string, limit, offset int) ([]models.CompliancePolicy, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	var items []models.CompliancePolicy
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT %s FROM compliance_policies WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, policyColumns),
		tenantID, limit, offset)
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

// evalRow mirrors the four scalar columns of compliance_evaluation_results.
// models.ComplianceEvaluationResult declares no db tags, and sqlx's default
// NameMapper lowercases a field name without touching the underscores, so
// PolicyID resolves to "policyid" rather than "policy_id". Scanning the model
// directly therefore failed on the first column with
// "missing destination name policy_id", and that error is not sentinel.NotFound,
// so GetLastEvaluation returned it to the handler and GET /baselines answered 500
// for every tenant that had at least one policy.
type evalRow struct {
	PolicyID    string    `db:"policy_id"`
	Status      string    `db:"status"`
	Score       float64   `db:"score"`
	EvaluatedAt time.Time `db:"evaluated_at"`
}

// LatestEvaluationByPolicy returns the most recent evaluation of one policy.
// Only the columns a baseline view needs are selected: failures and warnings are
// TEXT in the table and []string in the model, so pulling them would fail the
// scan. Score and evaluated_at are what the frontend passRate / lastScan come
// from, and those are the fields this method feeds.
func (r *Repository) LatestEvaluationByPolicy(ctx context.Context, tenantID, policyID string) (*models.ComplianceEvaluationResult, error) {
	var row evalRow
	if err := r.getOne(ctx, &row,
		`SELECT policy_id, status, score, evaluated_at
			FROM compliance_evaluation_results WHERE policy_id=$1 AND tenant_id=$2 ORDER BY evaluated_at DESC LIMIT 1`,
		policyID, tenantID); err != nil {
		return nil, err
	}
	return &models.ComplianceEvaluationResult{
		PolicyID:    row.PolicyID,
		Status:      row.Status,
		Score:       row.Score,
		EvaluatedAt: row.EvaluatedAt,
	}, nil
}

// --- Compliance Report ---

// CreateReport fills the three columns 066 made NOT NULL (name, framework,
// triggered_by). The earlier INSERT omitted them and would have been rejected
// by the constraint on every call.
func (r *Repository) CreateReport(ctx context.Context, report *models.ComplianceReport) error {
	report.ID = uuid.New().String()
	now := time.Now().UTC()
	report.CreatedAt = now
	report.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO compliance_reports (id, tenant_id, policy_id, name, description, framework, triggered_by, status, score, failures, created_at, updated_at)
			VALUES (:id, :tenant_id, :policy_id, :name, :description, :framework, :triggered_by, :status, :score, :failures, :created_at, :updated_at)`,
		report)
	return err
}

func (r *Repository) GetReportByPolicy(ctx context.Context, tenantID, policyID string) (*models.ComplianceReport, error) {
	var report models.ComplianceReport
	err := r.getOne(ctx, &report,
		fmt.Sprintf(`SELECT %s FROM compliance_reports WHERE policy_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 1`, reportColumns),
		policyID, tenantID)
	if err != nil {
		return nil, err
	}
	return &report, nil
}

// --- Compliance Score ---

// scoreRow mirrors compliance_scores with category_scores kept as the TEXT the
// table stores. sqlx cannot assign a TEXT column into a typed map — convertAssign
// has no case for map[string]float64 — so scanning the model directly failed on
// every tenant that had ever been scored. That error is not sentinel.NotFound, so
// it propagated out of GetLatestScore and made EvaluateCompliance fail after it
// had already inserted the evaluation row, leaving the score write as the one
// silently dropped step of the flow.
type scoreRow struct {
	OverallScore   float64   `db:"overall_score"`
	CategoryScores string    `db:"category_scores"`
	Trend          string    `db:"trend"`
	LastUpdated    time.Time `db:"last_updated"`
}

func (r *Repository) GetLatestScore(ctx context.Context, tenantID string) (*models.ComplianceScore, error) {
	var row scoreRow
	if err := r.getOne(ctx, &row,
		`SELECT score as overall_score, category_scores, trend, last_updated
			FROM compliance_scores WHERE tenant_id=$1 ORDER BY last_updated DESC LIMIT 1`, tenantID); err != nil {
		return nil, err
	}
	score := &models.ComplianceScore{
		OverallScore:   row.OverallScore,
		CategoryScores: map[string]float64{},
		Trend:          row.Trend,
		LastUpdated:    row.LastUpdated,
	}
	// UpsertScore stores the map as JSON, or "null" for an empty one.
	if raw := strings.TrimSpace(row.CategoryScores); raw != "" && raw != "null" {
		if err := json.Unmarshal([]byte(raw), &score.CategoryScores); err != nil {
			return nil, fmt.Errorf("decode compliance_scores.category_scores: %w", err)
		}
	}
	return score, nil
}

func (r *Repository) UpsertScore(ctx context.Context, tenantID string, score *models.ComplianceScore) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO compliance_scores (id, tenant_id, overall_score, category_scores, trend, last_updated)
			VALUES (:id, :tenant_id, :overall_score, :category_scores, :trend, :last_updated)
			ON CONFLICT (tenant_id) DO UPDATE SET overall_score=EXCLUDED.overall_score, category_scores=EXCLUDED.category_scores, trend=EXCLUDED.trend, last_updated=EXCLUDED.last_updated`,
		map[string]interface{}{
			"id":              uuid.New().String(),
			"tenant_id":       tenantID,
			"overall_score":   score.OverallScore,
			"category_scores": joinStringsForMap(score.CategoryScores),
			"trend":           score.Trend,
			"last_updated":    score.LastUpdated,
		})
	return err
}

// --- Audit Plan ---

func (r *Repository) CreateAuditPlan(ctx context.Context, plan *models.AuditPlan) error {
	plan.ID = uuid.New().String()
	plan.Status = "scheduled"
	now := time.Now().UTC()
	plan.CreatedAt = now
	plan.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO audit_plans (id, tenant_id, name, description, schedule, status, created_at, updated_at)
			VALUES (:id, :tenant_id, :name, :description, :schedule, :status, :created_at, :updated_at)`, plan)
	return err
}

func (r *Repository) GetAuditPlan(ctx context.Context, tenantID, id string) (*models.AuditPlan, error) {
	var plan models.AuditPlan
	if err := r.getOne(ctx, &plan,
		fmt.Sprintf(`SELECT %s FROM audit_plans WHERE id=$1 AND tenant_id=$2`, planColumns), id, tenantID); err != nil {
		return nil, err
	}
	return &plan, nil
}

func (r *Repository) ListAuditPlans(ctx context.Context, tenantID string, limit, offset int) ([]models.AuditPlan, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	var items []models.AuditPlan
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT %s FROM audit_plans WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, planColumns),
		tenantID, limit, offset)
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
	res, err := r.db.ExecContext(ctx,
		`UPDATE audit_executions SET status=$1, result=$2, ended_at=$3 WHERE id=$4 AND tenant_id=$5`,
		status, result, endedAt, id, tenantID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("audit execution %q: %w", id, sentinel.NotFound)
	}
	return nil
}

// --- Audit Report ---

func (r *Repository) CreateAuditReport(ctx context.Context, report *models.AuditReport) error {
	// Preserve a caller-supplied id: ExecuteAudit pre-generates the report id so
	// its findings can reference it before the report row exists, then persists
	// the report only after every finding was written. Without this, a finding
	// write failure between the two steps left an orphan report row behind.
	if report.ID == "" {
		report.ID = uuid.New().String()
	}
	report.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO audit_reports (id, execution_id, tenant_id, summary, findings_count, created_at)
			VALUES (:id, :execution_id, :tenant_id, :summary, :findings_count, :created_at)`, report)
	return err
}

func (r *Repository) GetAuditReport(ctx context.Context, tenantID, executionID string) (*models.AuditReport, error) {
	var report models.AuditReport
	err := r.getOne(ctx, &report,
		fmt.Sprintf(`SELECT %s FROM audit_reports WHERE execution_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 1`, auditReportColumns),
		executionID, tenantID)
	if err != nil {
		return nil, err
	}
	return &report, nil
}

// --- Audit Finding ---

// CreateFinding is the write half of the audit flow. Before it existed
// audit_findings had a SELECT and no INSERT anywhere in the service, so
// GET /audit/:id/findings could only ever return an empty slice.
func (r *Repository) CreateFinding(ctx context.Context, f *models.AuditFinding) error {
	if f.ID == "" {
		f.ID = uuid.New().String()
	}
	if f.Status == "" {
		f.Status = "open"
	}
	if f.CreatedAt.IsZero() {
		f.CreatedAt = time.Now().UTC()
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO audit_findings (id, report_id, tenant_id, target, severity, title, description, status, closed_at, created_at)
			VALUES (:id, :report_id, :tenant_id, :target, :severity, :title, :description, :status, :closed_at, :created_at)`,
		f)
	return err
}

func (r *Repository) GetAuditFindings(ctx context.Context, tenantID, reportID string) ([]models.AuditFinding, error) {
	// severity is a free-text label, so a plain ORDER BY severity sorts it
	// alphabetically (critical, high, low, medium) and shows medium above high.
	var items []models.AuditFinding
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT %s FROM audit_findings WHERE report_id=$1 AND tenant_id=$2
			ORDER BY CASE severity
				WHEN 'critical' THEN 4 WHEN 'high' THEN 3
				WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END DESC,
			created_at DESC`, findingColumns),
		reportID, tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// ListFindings returns the tenant's findings across all reports, newest first.
// It is what the frontend findings view reads.
func (r *Repository) ListFindings(ctx context.Context, tenantID string, limit, offset int) ([]models.AuditFinding, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	var items []models.AuditFinding
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT %s FROM audit_findings WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, findingColumns),
		tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// CloseFinding records the operator's reason. The previous implementation took
// reason in its signature and dropped it, and never checked RowsAffected, so
// closing a finding id that did not exist still reported success.
func (r *Repository) CloseFinding(ctx context.Context, tenantID, id string, reason string) error {
	now := time.Now().UTC()
	res, err := r.db.ExecContext(ctx,
		`UPDATE audit_findings SET status='closed', resolution=$1, closed_at=$2 WHERE id=$3 AND tenant_id=$4`,
		reason, now, id, tenantID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("audit finding %q: %w", id, sentinel.NotFound)
	}
	return nil
}

// --- Compliance Framework ---

func (r *Repository) ListFrameworks(ctx context.Context, tenantID string) ([]models.ComplianceFramework, error) {
	var items []models.ComplianceFramework
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf(`SELECT %s FROM compliance_frameworks WHERE tenant_id=$1 ORDER BY name`, frameworkColumns), tenantID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) GetFramework(ctx context.Context, tenantID, id string) (*models.ComplianceFramework, error) {
	var f models.ComplianceFramework
	if err := r.getOne(ctx, &f,
		fmt.Sprintf(`SELECT %s FROM compliance_frameworks WHERE id=$1 AND tenant_id=$2`, frameworkColumns), id, tenantID); err != nil {
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
		fmt.Sprintf(`SELECT %s FROM compliance_evidence WHERE policy_id=$1 AND tenant_id=$2 ORDER BY collected_at DESC`, evidenceColumns),
		policyID, tenantID)
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
			"id":              uuid.New().String(),
			"tenant_id":       tenantID,
			"framework":       result.Framework,
			"total_controls":  result.TotalControls,
			"implemented":     result.Implemented,
			"partial":         result.Partial,
			"not_implemented": result.NotImplemented,
			"gaps":            joinGaps(result.Gaps),
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
	if m == nil {
		return "null"
	}
	b, err := json.Marshal(m)
	if err != nil {
		return "null"
	}
	return string(b)
}

func joinGaps(gaps []models.GapAnalysisItem) string {
	if len(gaps) == 0 {
		return "null"
	}
	b, err := json.Marshal(gaps)
	if err != nil {
		return "null"
	}
	return string(b)
}
