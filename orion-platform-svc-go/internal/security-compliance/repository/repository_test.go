package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/security-compliance/models"
)

// Repository tests drive the real repository over sqlmock, which pins the SQL
// text, the argument order and the column mapping. That is where every defect
// in this module lived:
//
//   - the nine reads ran SELECT * against tables that 066, 571 and 572 had
//     grown columns in, so sqlx's safe scanner turned every row into
//     "missing destination name X" and every read endpoint answered 500;
//   - GetLatestScore scanned compliance_scores.category_scores (TEXT) straight
//     into a map[string]float64, which sqlx cannot do, so every tenant that had
//     ever been scored came back as an error; because that error is not
//     sentinel.NotFound it propagated out of EvaluateCompliance after the
//     evaluation row was already written, dropping the score silently;
//   - UpdateAuditExecution and CloseFinding never checked RowsAffected, so
//     updating or closing an id that did not exist still reported success, and
//     CloseFinding dropped its reason argument;
//   - GetAuditFindings ordered by the free-text severity label, which sorts
//     alphabetically and shows medium above high.
//
// Every expectation below is written against the statement the repository
// actually sends, so a regression to SELECT * or to an unordered severity is a
// query mismatch rather than a silent pass.

var (
	tenant    = "11111111-1111-1111-1111-111111111111"
	policyID  = "22222222-2222-2222-2222-222222222222"
	reportID  = "33333333-3333-3333-3333-333333333333"
	planID    = "44444444-4444-4444-4444-444444444444"
	execID    = "55555555-5555-5555-5555-555555555555"
	findingID = "66666666-6666-6666-6666-666666666666"
	fwID      = "77777777-7777-7777-7777-777777777777"
	evidID    = "88888888-8888-8888-8888-888888888888"
)

// normalize collapses whitespace so an expected statement can be written on one
// line even though the repository formats some of them across several.
func normalize(s string) string {
	return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(s, " "))
}

func newMock(t *testing.T) (*Repository, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		if normalize(expected) == normalize(actual) {
			return nil
		}
		return fmt.Errorf("sql mismatch:\n  expected: %s\n     actual: %s",
			normalize(expected), normalize(actual))
	})))
	if err != nil {
		t.Fatalf("sqlmock.New() error = %v", err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return NewRepository(sqlx.NewDb(raw, "postgres")), mock
}

// Column lists the repository selects, kept in the test so a change to either
// side fails the query matcher instead of the scan.
const (
	policyCols      = "id, tenant_id, name, framework, rules, status, created_at, updated_at"
	reportCols      = "id, tenant_id, policy_id, name, description, framework, triggered_by, status, score, failures, created_at, updated_at"
	planCols        = "id, tenant_id, name, description, schedule, status, created_at, updated_at"
	auditReportCols = "id, execution_id, tenant_id, summary, findings_count, created_at"
	findingCols     = "id, report_id, tenant_id, target, severity, title, description, status, resolution, closed_at, created_at"
	fwCols          = "id, tenant_id, name, description, version, controls, created_at"
	evidenceCols    = "id, tenant_id, policy_id, source, data, status, collected_at"
)

const (
	createPolicySQL      = "INSERT INTO compliance_policies (id, tenant_id, name, framework, rules, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
	getPolicySQL         = "SELECT " + policyCols + " FROM compliance_policies WHERE id=$1 AND tenant_id=$2"
	listPoliciesSQL      = "SELECT " + policyCols + " FROM compliance_policies WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
	insertEvalSQL        = "INSERT INTO compliance_evaluation_results (id, tenant_id, policy_id, status, score, failures, warnings, evaluated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
	latestEvalSQL        = "SELECT policy_id, status, score, evaluated_at FROM compliance_evaluation_results WHERE policy_id=$1 AND tenant_id=$2 ORDER BY evaluated_at DESC LIMIT 1"
	createReportSQL      = "INSERT INTO compliance_reports (id, tenant_id, policy_id, name, description, framework, triggered_by, status, score, failures, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)"
	getReportSQL         = "SELECT " + reportCols + " FROM compliance_reports WHERE policy_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 1"
	getScoreSQL          = "SELECT score as overall_score, category_scores, trend, last_updated FROM compliance_scores WHERE tenant_id=$1 ORDER BY last_updated DESC LIMIT 1"
	upsertScoreSQL       = "INSERT INTO compliance_scores (id, tenant_id, overall_score, category_scores, trend, last_updated) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (tenant_id) DO UPDATE SET overall_score=EXCLUDED.overall_score, category_scores=EXCLUDED.category_scores, trend=EXCLUDED.trend, last_updated=EXCLUDED.last_updated"
	createPlanSQL        = "INSERT INTO audit_plans (id, tenant_id, name, description, schedule, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
	getPlanSQL           = "SELECT " + planCols + " FROM audit_plans WHERE id=$1 AND tenant_id=$2"
	listPlansSQL         = "SELECT " + planCols + " FROM audit_plans WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
	createExecSQL        = "INSERT INTO audit_executions (id, plan_id, tenant_id, status, result, started_at, ended_at) VALUES ($1, $2, $3, $4, $5, $6, $7)"
	updateExecSQL        = "UPDATE audit_executions SET status=$1, result=$2, ended_at=$3 WHERE id=$4 AND tenant_id=$5"
	createReportAuditSQL = "INSERT INTO audit_reports (id, execution_id, tenant_id, summary, findings_count, created_at) VALUES ($1, $2, $3, $4, $5, $6)"
	getAuditReportSQL    = "SELECT " + auditReportCols + " FROM audit_reports WHERE execution_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 1"
	createFindingSQL     = "INSERT INTO audit_findings (id, report_id, tenant_id, target, severity, title, description, status, closed_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"
	getFindingsSQL       = "SELECT " + findingCols + " FROM audit_findings WHERE report_id=$1 AND tenant_id=$2 ORDER BY CASE severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END DESC, created_at DESC"
	listFindingsSQL      = "SELECT " + findingCols + " FROM audit_findings WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3"
	closeFindingSQL      = "UPDATE audit_findings SET status='closed', resolution=$1, closed_at=$2 WHERE id=$3 AND tenant_id=$4"
	listFwSQL            = "SELECT " + fwCols + " FROM compliance_frameworks WHERE tenant_id=$1 ORDER BY name"
	getFwSQL             = "SELECT " + fwCols + " FROM compliance_frameworks WHERE id=$1 AND tenant_id=$2"
	collectEvidenceSQL   = "INSERT INTO compliance_evidence (id, tenant_id, policy_id, source, data, status, collected_at) VALUES ($1, $2, $3, $4, $5, $6, $7)"
	getEvidenceSQL       = "SELECT " + evidenceCols + " FROM compliance_evidence WHERE policy_id=$1 AND tenant_id=$2 ORDER BY collected_at DESC"
	insertGapSQL         = "INSERT INTO gap_analysis_results (id, tenant_id, framework, total_controls, implemented, partial, not_implemented, gaps) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
)

func want(t *testing.T, mock sqlmock.Sqlmock) {
	t.Helper()
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// --- Compliance Policy ---

func TestCreatePolicyBindsTenantAndFillsTheGeneratedColumns(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(createPolicySQL).
		WithArgs(sqlmock.AnyArg(), tenant, "n", "soc2", "[]", "active",
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	p := &models.CompliancePolicy{TenantID: tenant, Name: "n", Framework: "soc2", Rules: "[]"}
	if err := repo.CreatePolicy(context.Background(), p); err != nil {
		t.Fatalf("CreatePolicy() error = %v", err)
	}
	if p.ID == "" || p.Status != "active" || p.CreatedAt.IsZero() || p.UpdatedAt.IsZero() {
		t.Fatalf("generated columns not filled: %+v", p)
	}
	want(t, mock)
}

func TestGetPolicySelectsTheNamedColumns(t *testing.T) {
	repo, mock := newMock(t)
	now := time.Date(2026, 8, 1, 9, 0, 0, 0, time.UTC)
	mock.ExpectQuery(getPolicySQL).WithArgs(policyID, tenant).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "framework", "rules", "status", "created_at", "updated_at",
		}).AddRow(policyID, tenant, "n", "soc2", "[]", "active", now, now))

	got, err := repo.GetPolicy(context.Background(), tenant, policyID)
	if err != nil {
		t.Fatalf("GetPolicy() error = %v", err)
	}
	if got.Name != "n" || got.TenantID != tenant || got.UpdatedAt != now {
		t.Fatalf("row not mapped: %+v", got)
	}
	want(t, mock)
}

func TestGetPolicyMapsNoRowsToNotFound(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(getPolicySQL).WithArgs(policyID, tenant).WillReturnError(sql.ErrNoRows)

	_, err := repo.GetPolicy(context.Background(), tenant, policyID)
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("want sentinel.NotFound, got %v", err)
	}
	want(t, mock)
}

func TestListPoliciesBindsTenantAndClampsThePaging(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(listPoliciesSQL).WithArgs(tenant, 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "framework", "rules", "status", "created_at", "updated_at",
		}).AddRow(policyID, tenant, "n", "soc2", "[]", "active", time.Now(), time.Now()))

	got, err := repo.ListPolicies(context.Background(), tenant, 0, -7)
	if err != nil {
		t.Fatalf("ListPolicies() error = %v", err)
	}
	if len(got) != 1 || got[0].TenantID != tenant {
		t.Fatalf("rows not mapped: %+v", got)
	}
	want(t, mock)
}

// --- Compliance Evaluation ---

func TestInsertEvaluationSerializesTheFailureListsAsText(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(insertEvalSQL).
		WithArgs(sqlmock.AnyArg(), tenant, policyID, "partial", 61.5,
			"CC6.1", "A.9.1", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.InsertEvaluation(context.Background(), tenant, &models.ComplianceEvaluationResult{
		PolicyID: policyID, Status: "partial", Score: 61.5,
		Failures: []string{"CC6.1"}, Warnings: []string{"A.9.1"}, EvaluatedAt: time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("InsertEvaluation() error = %v", err)
	}
	want(t, mock)
}

func TestLatestEvaluationByPolicyLeavesTheTextColumnsOut(t *testing.T) {
	repo, mock := newMock(t)
	// Only the four scalar columns are selected; the rows therefore carry them
	// and nothing else, so the scan proves failures/warnings are not requested.
	mock.ExpectQuery(latestEvalSQL).WithArgs(policyID, tenant).
		WillReturnRows(sqlmock.NewRows([]string{"policy_id", "status", "score", "evaluated_at"}).
			AddRow(policyID, "partial", 61.5, time.Date(2026, 8, 2, 8, 0, 0, 0, time.UTC)))

	got, err := repo.LatestEvaluationByPolicy(context.Background(), tenant, policyID)
	if err != nil {
		t.Fatalf("LatestEvaluationByPolicy() error = %v", err)
	}
	if got.PolicyID != policyID || got.Score != 61.5 || got.Status != "partial" {
		t.Fatalf("row not mapped: %+v", got)
	}
	want(t, mock)
}

// --- Compliance Report ---

func TestCreateReportFillsTheColumns066MadeNotNull(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(createReportSQL).
		WithArgs(sqlmock.AnyArg(), tenant, policyID, "n", "d", "soc2", "evaluate",
			"partial", 61.5, "[]", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	r := &models.ComplianceReport{TenantID: tenant, PolicyID: policyID, Name: "n",
		Description: "d", Framework: "soc2", TriggeredBy: "evaluate", Status: "partial",
		Score: 61.5, Failures: "[]"}
	if err := repo.CreateReport(context.Background(), r); err != nil {
		t.Fatalf("CreateReport() error = %v", err)
	}
	if r.ID == "" || r.CreatedAt.IsZero() {
		t.Fatalf("generated columns not filled: %+v", r)
	}
	want(t, mock)
}

func TestGetReportByPolicySelectsTheNamedColumns(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(getReportSQL).WithArgs(policyID, tenant).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "policy_id", "name", "description", "framework", "triggered_by",
			"status", "score", "failures", "created_at", "updated_at",
		}).AddRow(reportID, tenant, policyID, "n", "d", "soc2", "evaluate", "partial",
			61.5, "[]", time.Now(), time.Now()))

	got, err := repo.GetReportByPolicy(context.Background(), tenant, policyID)
	if err != nil {
		t.Fatalf("GetReportByPolicy() error = %v", err)
	}
	if got.TenantID != tenant || got.Score != 61.5 {
		t.Fatalf("row not mapped: %+v", got)
	}
	want(t, mock)
}

// --- Compliance Score ---

func TestGetLatestScoreDecodesTheCategoryScoresText(t *testing.T) {
	for _, tc := range []struct {
		raw      string
		wantLen  int
		wantAcc  float64
		wantNull bool
	}{
		{raw: `{"access":75.5,"logging":82}`, wantLen: 2, wantAcc: 75.5},
		{raw: "null", wantLen: 0, wantNull: true},
		{raw: "", wantLen: 0, wantNull: true},
	} {
		repo, mock := newMock(t)
		updated := time.Date(2026, 8, 3, 7, 0, 0, 0, time.UTC)
		mock.ExpectQuery(getScoreSQL).WithArgs(tenant).
			WillReturnRows(sqlmock.NewRows([]string{"overall_score", "category_scores", "trend", "last_updated"}).
				AddRow(61.5, tc.raw, "improving", updated))

		got, err := repo.GetLatestScore(context.Background(), tenant)
		if err != nil {
			t.Fatalf("GetLatestScore(%q) error = %v", tc.raw, err)
		}
		if got.OverallScore != 61.5 || got.Trend != "improving" || !got.LastUpdated.Equal(updated) {
			t.Fatalf("scalar columns not mapped: %+v", got)
		}
		if got.CategoryScores == nil {
			t.Fatalf("GetLatestScore(%q) returned a nil map, the handler would send null to the frontend", tc.raw)
		}
		if len(got.CategoryScores) != tc.wantLen {
			t.Fatalf("GetLatestScore(%q) decoded %d categories, want %d", tc.raw, len(got.CategoryScores), tc.wantLen)
		}
		if got.CategoryScores["access"] != tc.wantAcc {
			t.Fatalf("GetLatestScore(%q) decoded access=%v, want %v", tc.raw, got.CategoryScores["access"], tc.wantAcc)
		}
		want(t, mock)
	}
}

func TestGetLatestScoreReportsMalformedCategoryScores(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(getScoreSQL).WithArgs(tenant).
		WillReturnRows(sqlmock.NewRows([]string{"overall_score", "category_scores", "trend", "last_updated"}).
			AddRow(61.5, "not-json", "stable", time.Now().UTC()))

	_, err := repo.GetLatestScore(context.Background(), tenant)
	if err == nil || !strings.Contains(err.Error(), "category_scores") {
		t.Fatalf("want a decode error naming category_scores, got %v", err)
	}
	want(t, mock)
}

func TestGetLatestScoreMapsNoRowsToNotFound(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(getScoreSQL).WithArgs(tenant).WillReturnError(sql.ErrNoRows)

	_, err := repo.GetLatestScore(context.Background(), tenant)
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("want sentinel.NotFound, got %v", err)
	}
	want(t, mock)
}

func TestUpsertScoreSerializesTheCategoryScoresAsJSON(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(upsertScoreSQL).
		WithArgs(sqlmock.AnyArg(), tenant, 61.5, `{"partial":61.5}`, "improving", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.UpsertScore(context.Background(), tenant, &models.ComplianceScore{
		OverallScore: 61.5, CategoryScores: map[string]float64{"partial": 61.5},
		Trend: "improving", LastUpdated: time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("UpsertScore() error = %v", err)
	}
	want(t, mock)
}

// --- Audit Plan ---

func TestCreateAuditPlanBindsTenant(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(createPlanSQL).
		WithArgs(sqlmock.AnyArg(), tenant, "p", "d", "0 2 * * *", "scheduled",
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	p := &models.AuditPlan{TenantID: tenant, Name: "p", Description: "d", Schedule: "0 2 * * *"}
	if err := repo.CreateAuditPlan(context.Background(), p); err != nil {
		t.Fatalf("CreateAuditPlan() error = %v", err)
	}
	if p.ID == "" || p.Status != "scheduled" {
		t.Fatalf("generated columns not filled: %+v", p)
	}
	want(t, mock)
}

func TestGetAuditPlanMapsNoRowsToNotFound(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(getPlanSQL).WithArgs(planID, tenant).WillReturnError(sql.ErrNoRows)

	_, err := repo.GetAuditPlan(context.Background(), tenant, planID)
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("want sentinel.NotFound, got %v", err)
	}
	want(t, mock)
}

func TestListAuditPlansBindsTenantAndClamps(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(listPlansSQL).WithArgs(tenant, 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "description", "schedule", "status", "created_at", "updated_at",
		}).AddRow(planID, tenant, "p", "d", "0 2 * * *", "scheduled", time.Now(), time.Now()))

	got, err := repo.ListAuditPlans(context.Background(), tenant, 0, -1)
	if err != nil {
		t.Fatalf("ListAuditPlans() error = %v", err)
	}
	if len(got) != 1 || got[0].ID != planID {
		t.Fatalf("rows not mapped: %+v", got)
	}
	want(t, mock)
}

// --- Audit Execution ---

func TestCreateAuditExecutionFillsTheGeneratedColumns(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(createExecSQL).
		WithArgs(sqlmock.AnyArg(), planID, tenant, "running", "{}",
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	e := &models.AuditExecution{PlanID: planID, TenantID: tenant, Status: "running", Result: "{}"}
	if err := repo.CreateAuditExecution(context.Background(), e); err != nil {
		t.Fatalf("CreateAuditExecution() error = %v", err)
	}
	if e.ID == "" || e.StartedAt.IsZero() {
		t.Fatalf("generated columns not filled: %+v", e)
	}
	want(t, mock)
}

func TestUpdateAuditExecutionReturnsNotFoundForAnUnknownExecution(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(updateExecSQL).
		WithArgs("completed", "{}", sqlmock.AnyArg(), execID, tenant).
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := repo.UpdateAuditExecution(context.Background(), tenant, execID, "completed", "{}", nil)
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("a no-op update must report not found, got %v", err)
	}
	want(t, mock)
}

func TestUpdateAuditExecutionSucceedsWhenARowChanged(t *testing.T) {
	repo, mock := newMock(t)
	now := time.Now().UTC()
	mock.ExpectExec(updateExecSQL).
		WithArgs("failed", "{}", sqlmock.AnyArg(), execID, tenant).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.UpdateAuditExecution(context.Background(), tenant, execID, "failed", "{}", &now); err != nil {
		t.Fatalf("UpdateAuditExecution() error = %v", err)
	}
	want(t, mock)
}

// --- Audit Report ---

func TestCreateAuditReportKeepsACallerSuppliedID(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(createReportAuditSQL).
		WithArgs(reportID, execID, tenant, "{}", 3, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	r := &models.AuditReport{ID: reportID, ExecutionID: execID, TenantID: tenant, Summary: "{}", FindingsCount: 3}
	if err := repo.CreateAuditReport(context.Background(), r); err != nil {
		t.Fatalf("CreateAuditReport() error = %v", err)
	}
	if r.ID != reportID {
		t.Fatalf("caller id overwritten: %s", r.ID)
	}
	want(t, mock)
}

func TestCreateAuditReportGeneratesAnIDWhenNoneWasGiven(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(createReportAuditSQL).
		WithArgs(sqlmock.AnyArg(), execID, tenant, "{}", 0, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	r := &models.AuditReport{ExecutionID: execID, TenantID: tenant, Summary: "{}"}
	if err := repo.CreateAuditReport(context.Background(), r); err != nil {
		t.Fatalf("CreateAuditReport() error = %v", err)
	}
	if r.ID == "" {
		t.Fatal("no id generated")
	}
	want(t, mock)
}

func TestGetAuditReportMapsNoRowsToNotFound(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(getAuditReportSQL).WithArgs(execID, tenant).WillReturnError(sql.ErrNoRows)

	_, err := repo.GetAuditReport(context.Background(), tenant, execID)
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("want sentinel.NotFound, got %v", err)
	}
	want(t, mock)
}

// --- Audit Finding ---

func TestCreateFindingWritesTargetAndFillsTheDefaults(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(createFindingSQL).
		WithArgs(sqlmock.AnyArg(), reportID, tenant, "iam", "high", "CC6.1 x", "d", "open",
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	f := &models.AuditFinding{ReportID: reportID, TenantID: tenant, Target: "iam",
		Severity: "high", Title: "CC6.1 x", Description: "d"}
	if err := repo.CreateFinding(context.Background(), f); err != nil {
		t.Fatalf("CreateFinding() error = %v", err)
	}
	if f.ID == "" || f.Status != "open" || f.CreatedAt.IsZero() {
		t.Fatalf("generated columns not filled: %+v", f)
	}
	want(t, mock)
}

func TestCreateFindingPreservesAStatusTheServiceSet(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(createFindingSQL).
		WithArgs(findingID, reportID, tenant, "iam", "low", "t", "", "closed",
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	now := time.Now().UTC()
	f := &models.AuditFinding{ID: findingID, ReportID: reportID, TenantID: tenant, Target: "iam",
		Severity: "low", Title: "t", Status: "closed", CreatedAt: now}
	if err := repo.CreateFinding(context.Background(), f); err != nil {
		t.Fatalf("CreateFinding() error = %v", err)
	}
	if f.Status != "closed" {
		t.Fatalf("service status overwritten: %s", f.Status)
	}
	want(t, mock)
}

func TestGetAuditFindingsRanksSeverityInsteadOfSortingItAlphabetically(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(getFindingsSQL).WithArgs(reportID, tenant).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "report_id", "tenant_id", "target", "severity", "title", "description",
			"status", "resolution", "closed_at", "created_at",
		}).AddRow(findingID, reportID, tenant, "iam", "high", "t", "d", "open", "", nil, time.Now()))

	got, err := repo.GetAuditFindings(context.Background(), tenant, reportID)
	if err != nil {
		t.Fatalf("GetAuditFindings() error = %v", err)
	}
	if len(got) != 1 || got[0].Target != "iam" || got[0].Severity != "high" {
		t.Fatalf("rows not mapped: %+v", got)
	}
	if strings.Contains(getFindingsSQL, "ORDER BY severity") {
		t.Fatal("severity is still sorted as text")
	}
	want(t, mock)
}

func TestListFindingsBindsTenantAndClamps(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(listFindingsSQL).WithArgs(tenant, 50, 0).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "report_id", "tenant_id", "target", "severity", "title", "description",
			"status", "resolution", "closed_at", "created_at",
		}).AddRow(findingID, reportID, tenant, "iam", "high", "t", "d", "open", "fixed", nil, time.Now()))

	got, err := repo.ListFindings(context.Background(), tenant, 0, -1)
	if err != nil {
		t.Fatalf("ListFindings() error = %v", err)
	}
	if len(got) != 1 || got[0].TenantID != tenant || got[0].Resolution != "fixed" {
		t.Fatalf("rows not mapped: %+v", got)
	}
	want(t, mock)
}

func TestCloseFindingPersistsTheReason(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(closeFindingSQL).
		WithArgs("remediated", sqlmock.AnyArg(), findingID, tenant).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.CloseFinding(context.Background(), tenant, findingID, "remediated"); err != nil {
		t.Fatalf("CloseFinding() error = %v", err)
	}
	if !strings.Contains(closeFindingSQL, "resolution=$1") {
		t.Fatal("the reason is no longer written to the resolution column")
	}
	want(t, mock)
}

func TestCloseFindingReturnsNotFoundForAnUnknownFinding(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(closeFindingSQL).
		WithArgs("r", sqlmock.AnyArg(), findingID, tenant).
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := repo.CloseFinding(context.Background(), tenant, findingID, "r")
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("a no-op close must report not found, got %v", err)
	}
	want(t, mock)
}

// --- Compliance Framework ---

func TestListFrameworksBindsTenant(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(listFwSQL).WithArgs(tenant).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "description", "version", "controls", "created_at",
		}).AddRow(fwID, tenant, "soc2", "d", "1", "[]", time.Now()))

	got, err := repo.ListFrameworks(context.Background(), tenant)
	if err != nil {
		t.Fatalf("ListFrameworks() error = %v", err)
	}
	if len(got) != 1 || got[0].Name != "soc2" || got[0].TenantID != tenant {
		t.Fatalf("rows not mapped: %+v", got)
	}
	want(t, mock)
}

func TestGetFrameworkSelectsTheNamedColumns(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(getFwSQL).WithArgs(fwID, tenant).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "description", "version", "controls", "created_at",
		}).AddRow(fwID, tenant, "soc2", "d", "1", "[]", time.Now()))

	got, err := repo.GetFramework(context.Background(), tenant, fwID)
	if err != nil {
		t.Fatalf("GetFramework() error = %v", err)
	}
	if got.ID != fwID {
		t.Fatalf("row not mapped: %+v", got)
	}
	want(t, mock)
}

// --- Evidence ---

func TestCollectEvidenceBindsTenant(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(collectEvidenceSQL).
		WithArgs(sqlmock.AnyArg(), tenant, policyID, "audit", "{}", "collected", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	e := &models.Evidence{TenantID: tenant, PolicyID: policyID, Source: "audit", Data: "{}"}
	if err := repo.CollectEvidence(context.Background(), e); err != nil {
		t.Fatalf("CollectEvidence() error = %v", err)
	}
	if e.ID == "" || e.Status != "collected" || e.CollectedAt.IsZero() {
		t.Fatalf("generated columns not filled: %+v", e)
	}
	want(t, mock)
}

func TestGetEvidenceSelectsTheNamedColumns(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectQuery(getEvidenceSQL).WithArgs(policyID, tenant).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "policy_id", "source", "data", "status", "collected_at",
		}).AddRow(evidID, tenant, policyID, "audit", "{}", "collected", time.Now()))

	got, err := repo.GetEvidence(context.Background(), tenant, policyID)
	if err != nil {
		t.Fatalf("GetEvidence() error = %v", err)
	}
	if len(got) != 1 || got[0].Source != "audit" {
		t.Fatalf("rows not mapped: %+v", got)
	}
	want(t, mock)
}

// --- Gap Analysis ---

func TestInsertGapAnalysisSerializesTheGapsAsJSON(t *testing.T) {
	repo, mock := newMock(t)
	mock.ExpectExec(insertGapSQL).
		WithArgs(sqlmock.AnyArg(), tenant, "pci-dss", 10, 0, 10, 0,
			`[{"control_id":"4.1","control_name":"c","compliance":"not_implemented","recommendation":"r"}]`).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.InsertGapAnalysis(context.Background(), tenant, &models.GapAnalysisResult{
		Framework: "pci-dss", TotalControls: 10, Implemented: 0, Partial: 10, NotImplemented: 0,
		Gaps: []models.GapAnalysisItem{{ControlID: "4.1", ControlName: "c", Compliance: "not_implemented", Recommendation: "r"}},
	})
	if err != nil {
		t.Fatalf("InsertGapAnalysis() error = %v", err)
	}
	want(t, mock)
}

// --- Helpers and pins ---

func TestJoinHelpersEncodeEmptyCollections(t *testing.T) {
	if got := joinStrings(nil); got != "" {
		t.Fatalf("joinStrings(nil) = %q", got)
	}
	if got := joinStringsForMap(nil); got != "null" {
		t.Fatalf("joinStringsForMap(nil) = %q, GetLatestScore treats null as an empty map", got)
	}
	if got := joinStringsForMap(map[string]float64{"a": 1}); got != `{"a":1}` {
		t.Fatalf("joinStringsForMap = %q", got)
	}
	if got := joinGaps(nil); got != "null" {
		t.Fatalf("joinGaps(nil) = %q", got)
	}
}

// TestNoStatementSelectsStar pins the explicit-column-list fix. sqlx scans in
// safe mode and the compliance tables have columns the models do not declare
// (066 created them, 571 and 572 grew them), so any statement that selects star
// fails on the first row and the endpoint answers 500. The per-method
// expectations above already pin each statement, this one catches a new read.
func TestNoStatementSelectsStar(t *testing.T) {
	src, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatalf("read repository.go: %v", err)
	}
	// Backtick-delimited strings in the file are SQL statements; the ones that
	// contain FROM are the reads. The file's header comment also quotes
	// SELECT * inside backticks, which is why FROM is required to discriminate.
	for i, s := range strings.Split(string(src), "`") {
		if i%2 == 0 || !strings.Contains(s, "FROM") {
			continue
		}
		if strings.Contains(strings.ToUpper(s), "SELECT *") {
			t.Fatalf("statement selects star: %s", s)
		}
	}
}
