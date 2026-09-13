package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/security-compliance/models"
)

// repoFake records every call so a test can prove that the tenant id reached the
// store, and exposes one error knob per write path so an error can be injected
// at the right step of a multi-step flow.
type repoFake struct {
	tenants []string

	policyErr       error
	policies        map[string]*models.CompliancePolicy
	listPolicies    []models.CompliancePolicy
	listPoliciesErr error
	policiesLimit   int
	policiesOffset  int

	evalErr        error
	evaluations    []*models.ComplianceEvaluationResult
	latestByPolicy *models.ComplianceEvaluationResult
	latestErr      error
	latestPolicyID string

	createReportErr error
	reports         []*models.ComplianceReport

	prevScoreErr error
	prevScore    *models.ComplianceScore
	scoreErr     error
	scores       []*models.ComplianceScore

	gapErr     error
	gapResults []*models.GapAnalysisResult

	planErr     error
	plans       map[string]*models.ComplianceFramework
	planListErr error
	auditPlans  []*models.AuditPlan

	execErr         error
	executions      []*models.AuditExecution
	reportErr       error
	auditReport     *models.AuditReport
	reportInsertErr error
	findingsErr     error
	findings        []*models.AuditFinding
	listFindings    []models.AuditFinding
	listFindingsErr error
	closeErr        error
	closed          []struct{ id, reason string }

	evidenceErr error
	collected   []*models.Evidence

	frameworks    []models.ComplianceFramework
	frameworksErr error
	framework     *models.ComplianceFramework
}

func (r *repoFake) sawTenant(tenantID string) {
	r.tenants = append(r.tenants, tenantID)
}

func (r *repoFake) tenantsFor() []string { return r.tenants }

// allSeenTenantsEqual fails the test unless every single repository call in the
// test was made with the same tenant id. That is the invariant the whole module
// used to violate.
func (r *repoFake) assertTenant(t *testing.T, want string) {
	t.Helper()
	if len(r.tenants) == 0 {
		t.Fatalf("the repository was never called")
	}
	for _, got := range r.tenants {
		if got != want {
			t.Fatalf("repository call reached tenant %q, want %q (all: %v)", got, want, r.tenants)
		}
	}
}

var _ RepositoryInterface = (*repoFake)(nil)

func (r *repoFake) CloseFinding(ctx context.Context, tenantID, id string, reason string) error {
	r.sawTenant(tenantID)
	r.closed = append(r.closed, struct{ id, reason string }{id, reason})
	return r.closeErr
}

func (r *repoFake) CollectEvidence(ctx context.Context, e *models.Evidence) error {
	r.sawTenant(e.TenantID)
	r.collected = append(r.collected, e)
	return r.evidenceErr
}

func (r *repoFake) CreateAuditExecution(ctx context.Context, exec *models.AuditExecution) error {
	r.sawTenant(exec.TenantID)
	if exec.ID == "" {
		exec.ID = "exec-1"
	}
	if exec.StartedAt.IsZero() {
		exec.StartedAt = time.Now().UTC()
	}
	r.executions = append(r.executions, exec)
	return r.execErr
}

func (r *repoFake) CreateAuditPlan(ctx context.Context, plan *models.AuditPlan) error {
	r.sawTenant(plan.TenantID)
	if plan.ID == "" {
		plan.ID = "plan-1"
	}
	r.auditPlans = append(r.auditPlans, plan)
	return nil
}

func (r *repoFake) CreateAuditReport(ctx context.Context, report *models.AuditReport) error {
	r.sawTenant(report.TenantID)
	if r.reportInsertErr != nil {
		return r.reportInsertErr
	}
	if report.ID == "" {
		report.ID = "report-1"
	}
	report.CreatedAt = time.Now().UTC()
	r.auditReport = report
	return nil
}

func (r *repoFake) CreateFinding(ctx context.Context, f *models.AuditFinding) error {
	r.sawTenant(f.TenantID)
	if f.ID == "" {
		f.ID = "finding-1"
	}
	if f.Status == "" {
		f.Status = "open"
	}
	if f.CreatedAt.IsZero() {
		f.CreatedAt = time.Now().UTC()
	}
	r.findings = append(r.findings, f)
	return r.findingsErr
}

func (r *repoFake) CreatePolicy(ctx context.Context, p *models.CompliancePolicy) error {
	r.sawTenant(p.TenantID)
	if p.ID == "" {
		p.ID = "policy-new"
	}
	r.policies = map[string]*models.CompliancePolicy{p.ID: p}
	return r.policyErr
}

func (r *repoFake) CreateReport(ctx context.Context, report *models.ComplianceReport) error {
	r.sawTenant(report.TenantID)
	if report.ID == "" {
		report.ID = "cr-1"
	}
	if report.CreatedAt.IsZero() {
		now := time.Now().UTC()
		report.CreatedAt, report.UpdatedAt = now, now
	}
	r.reports = append(r.reports, report)
	return r.createReportErr
}

func (r *repoFake) GetAuditFindings(ctx context.Context, tenantID, reportID string) ([]models.AuditFinding, error) {
	r.sawTenant(tenantID)
	if r.auditReport != nil && reportID == r.auditReport.ID {
		out := make([]models.AuditFinding, 0, len(r.findings))
		for _, f := range r.findings {
			out = append(out, *f)
		}
		return out, nil
	}
	return []models.AuditFinding{}, nil
}

func (r *repoFake) GetAuditPlan(ctx context.Context, tenantID, id string) (*models.AuditPlan, error) {
	r.sawTenant(tenantID)
	if r.planErr != nil {
		return nil, r.planErr
	}
	for _, p := range r.auditPlans {
		if p.ID == id {
			return p, nil
		}
	}
	return nil, sentinel.NotFound
}

func (r *repoFake) GetAuditReport(ctx context.Context, tenantID, executionID string) (*models.AuditReport, error) {
	r.sawTenant(tenantID)
	if r.auditReport != nil {
		return r.auditReport, nil
	}
	return nil, sentinel.NotFound
}

func (r *repoFake) GetEvidence(ctx context.Context, tenantID, policyID string) ([]models.Evidence, error) {
	r.sawTenant(tenantID)
	out := make([]models.Evidence, 0, len(r.collected))
	for _, e := range r.collected {
		if e.PolicyID == policyID {
			out = append(out, *e)
		}
	}
	return out, nil
}

func (r *repoFake) GetFramework(ctx context.Context, tenantID, id string) (*models.ComplianceFramework, error) {
	r.sawTenant(tenantID)
	if r.framework != nil {
		return r.framework, nil
	}
	return nil, sentinel.NotFound
}

func (r *repoFake) GetLatestScore(ctx context.Context, tenantID string) (*models.ComplianceScore, error) {
	r.sawTenant(tenantID)
	if r.prevScoreErr != nil {
		return nil, r.prevScoreErr
	}
	return r.prevScore, nil
}

func (r *repoFake) GetPolicy(ctx context.Context, tenantID, id string) (*models.CompliancePolicy, error) {
	r.sawTenant(tenantID)
	if r.policyErr != nil {
		return nil, r.policyErr
	}
	if p, ok := r.policies[id]; ok {
		return p, nil
	}
	return nil, sentinel.NotFound
}

func (r *repoFake) GetReportByPolicy(ctx context.Context, tenantID, policyID string) (*models.ComplianceReport, error) {
	r.sawTenant(tenantID)
	for _, rep := range r.reports {
		if rep.PolicyID == policyID {
			return rep, nil
		}
	}
	return nil, sentinel.NotFound
}

func (r *repoFake) InsertEvaluation(ctx context.Context, tenantID string, result *models.ComplianceEvaluationResult) error {
	r.sawTenant(tenantID)
	r.evaluations = append(r.evaluations, result)
	return r.evalErr
}

func (r *repoFake) InsertGapAnalysis(ctx context.Context, tenantID string, result *models.GapAnalysisResult) error {
	r.sawTenant(tenantID)
	r.gapResults = append(r.gapResults, result)
	return r.gapErr
}

func (r *repoFake) LatestEvaluationByPolicy(ctx context.Context, tenantID, policyID string) (*models.ComplianceEvaluationResult, error) {
	r.sawTenant(tenantID)
	if r.latestErr != nil {
		return nil, r.latestErr
	}
	if r.latestByPolicy != nil && r.latestByPolicy.PolicyID == policyID {
		return r.latestByPolicy, nil
	}
	return nil, sentinel.NotFound
}

func (r *repoFake) ListAuditPlans(ctx context.Context, tenantID string, limit, offset int) ([]models.AuditPlan, error) {
	r.sawTenant(tenantID)
	if r.planListErr != nil {
		return nil, r.planListErr
	}
	out := make([]models.AuditPlan, 0, len(r.auditPlans))
	for _, p := range r.auditPlans {
		out = append(out, *p)
	}
	return out, nil
}

func (r *repoFake) ListFindings(ctx context.Context, tenantID string, limit, offset int) ([]models.AuditFinding, error) {
	r.sawTenant(tenantID)
	if r.listFindingsErr != nil {
		return nil, r.listFindingsErr
	}
	return r.listFindings, nil
}

func (r *repoFake) ListFrameworks(ctx context.Context, tenantID string) ([]models.ComplianceFramework, error) {
	r.sawTenant(tenantID)
	if r.frameworksErr != nil {
		return nil, r.frameworksErr
	}
	return r.frameworks, nil
}

func (r *repoFake) ListPolicies(ctx context.Context, tenantID string, limit, offset int) ([]models.CompliancePolicy, error) {
	r.sawTenant(tenantID)
	r.policiesLimit, r.policiesOffset = limit, offset
	if r.listPoliciesErr != nil {
		return nil, r.listPoliciesErr
	}
	if len(r.listPolicies) > 0 {
		return r.listPolicies, nil
	}
	out := make([]models.CompliancePolicy, 0, len(r.policies))
	for _, p := range r.policies {
		if p.TenantID == tenantID {
			out = append(out, *p)
		}
	}
	return out, nil
}

func (r *repoFake) UpdateAuditExecution(ctx context.Context, tenantID, id string, status, result string, endedAt *time.Time) error {
	r.sawTenant(tenantID)
	for _, e := range r.executions {
		if e.ID == id {
			e.Status, e.Result, e.EndedAt = status, result, endedAt
			return nil
		}
	}
	return sentinel.NotFound
}

func (r *repoFake) UpsertScore(ctx context.Context, tenantID string, score *models.ComplianceScore) error {
	r.sawTenant(tenantID)
	r.scores = append(r.scores, score)
	return r.scoreErr
}

func newSvc(r *repoFake) *Service { return NewService(r) }

// --- EvaluateCompliance ---

func TestEvaluateCompliancePersistsTheReportAndTheTenantScore(t *testing.T) {
	r := &repoFake{policies: map[string]*models.CompliancePolicy{
		"p-1": {ID: "p-1", TenantID: "tenant-1", Name: "SOC2 baseline", Framework: "soc2"},
	}}
	svc := newSvc(r)

	res, err := svc.EvaluateCompliance(context.Background(), "tenant-1", models.EvaluateComplianceRequest{PolicyID: "p-1"})
	if err != nil {
		t.Fatalf("EvaluateCompliance: %v", err)
	}
	if res == nil || res.PolicyID != "p-1" {
		t.Fatalf("result = %v", res)
	}
	if len(res.Warnings) == 0 {
		t.Fatalf("evaluation produced no warnings; the control catalog must contribute them")
	}
	r.assertTenant(t, "tenant-1")

	if len(r.evaluations) != 1 || r.evaluations[0].PolicyID != "p-1" {
		t.Fatalf("inserted %d evaluations: %v", len(r.evaluations), r.evaluations)
	}

	if len(r.reports) != 1 {
		t.Fatalf("evaluation did not persist a compliance report, so GET /report/:policyId can never succeed: %v", r.reports)
	}
	rep := r.reports[0]
	if rep.PolicyID != "p-1" || rep.Name != "SOC2 baseline" || rep.Framework != "soc2" {
		t.Fatalf("report identity = (%q %q %q)", rep.PolicyID, rep.Name, rep.Framework)
	}
	if rep.TriggeredBy != "evaluate" {
		t.Fatalf("triggeredBy = %q", rep.TriggeredBy)
	}
	if rep.Status != res.Status || rep.Score != res.Score {
		t.Fatalf("report verdict (%s %v) disagrees with the evaluation (%s %v)", rep.Status, rep.Score, res.Status, res.Score)
	}
	var decoded []string
	if err := json.Unmarshal([]byte(rep.Failures), &decoded); err != nil {
		t.Fatalf("report failures are not JSON: %v\n%s", err, rep.Failures)
	}
	if len(decoded) != len(res.Failures)+len(res.Warnings) {
		t.Fatalf("report failures hold %d entries, want %d", len(decoded), len(res.Failures)+len(res.Warnings))
	}

	if len(r.scores) != 1 {
		t.Fatalf("evaluation did not persist a tenant score, so GET /score always invents one: %v", r.scores)
	}
	sc := r.scores[0]
	if sc.OverallScore != res.Score {
		t.Fatalf("score = %v, want %v", sc.OverallScore, res.Score)
	}
	if sc.Trend != "new" {
		t.Fatalf("trend = %q for a tenant with no previous score, want new", sc.Trend)
	}
	if _, ok := sc.CategoryScores[res.Status]; !ok {
		t.Fatalf("category scores = %v, want the %q bucket", sc.CategoryScores, res.Status)
	}
	if sc.LastUpdated.UTC().Equal(res.EvaluatedAt.UTC()) != true {
		t.Fatalf("lastUpdated = %v, want the evaluation timestamp", sc.LastUpdated)
	}
}

func TestEvaluateComplianceCarriesThePolicyFrameworkThrough(t *testing.T) {
	// The request omits a framework; the policy's framework must be used, not
	// the SOC2 default, otherwise a PCI policy scores against SOC2 controls.
	r := &repoFake{policies: map[string]*models.CompliancePolicy{
		"p-1": {ID: "p-1", TenantID: "tenant-1", Name: "PCI baseline", Framework: "pci-dss"},
	}}
	svc := newSvc(r)
	res, err := svc.EvaluateCompliance(context.Background(), "tenant-1", models.EvaluateComplianceRequest{PolicyID: "p-1"})
	if err != nil {
		t.Fatalf("EvaluateCompliance: %v", err)
	}
	if len(res.Warnings) == 0 {
		t.Fatalf("no warnings produced")
	}
	if !strings.Contains(strings.Join(res.Warnings, "\n"), "Firewall") {
		t.Fatalf("warnings came from the wrong framework:\n%s", strings.Join(res.Warnings, "\n"))
	}
	if r.reports[0].Framework != "pci-dss" {
		t.Fatalf("report framework = %q", r.reports[0].Framework)
	}
}

func TestEvaluateCompliancePrefersTheRequestFramework(t *testing.T) {
	r := &repoFake{policies: map[string]*models.CompliancePolicy{
		"p-1": {ID: "p-1", TenantID: "tenant-1", Name: "n", Framework: "soc2"},
	}}
	svc := newSvc(r)
	res, err := svc.EvaluateCompliance(context.Background(), "tenant-1", models.EvaluateComplianceRequest{PolicyID: "p-1", Framework: "CIS"})
	if err != nil {
		t.Fatalf("EvaluateCompliance: %v", err)
	}
	if !strings.Contains(strings.Join(res.Warnings, "\n"), "Inventory") {
		t.Fatalf("request framework was ignored:\n%s", strings.Join(res.Warnings, "\n"))
	}
}

func TestEvaluateComplianceMapsAMissingPolicyToTheSentinel(t *testing.T) {
	svc := newSvc(&repoFake{})
	_, err := svc.EvaluateCompliance(context.Background(), "tenant-1", models.EvaluateComplianceRequest{PolicyID: "nope"})
	if err == nil {
		t.Fatal("evaluating an unknown policy succeeded")
	}
	if !errors.Is(err, ErrPolicyNotExists) {
		t.Errorf("errors.Is(err, ErrPolicyNotExists) is false; the sentinel is unreachable")
	}
	if !IsNotFound(err) {
		t.Errorf("IsNotFound(err) is false; the 404 branch is dead")
	}
	if !errors.Is(err, sentinel.NotFound) {
		t.Errorf("errors.Is(err, sentinel.NotFound) is false")
	}
}

func TestEvaluateComplianceSurfacesStoreErrorsUnwrapped(t *testing.T) {
	boom := errors.New("relation compliance_evaluation_results does not exist")
	svc := newSvc(&repoFake{
		policies: map[string]*models.CompliancePolicy{"p-1": {ID: "p-1", TenantID: "t", Name: "n", Framework: "soc2"}},
		evalErr:  boom,
	})
	_, err := svc.EvaluateCompliance(context.Background(), "t", models.EvaluateComplianceRequest{PolicyID: "p-1"})
	if !errors.Is(err, boom) {
		t.Fatalf("store error was rewritten: %v", err)
	}
}

func TestEvaluateComplianceFailsClosedWhenTheReportWriteFails(t *testing.T) {
	svc := newSvc(&repoFake{
		policies:        map[string]*models.CompliancePolicy{"p-1": {ID: "p-1", TenantID: "t", Name: "n", Framework: "soc2"}},
		createReportErr: errors.New("constraint violation"),
	})
	if _, err := svc.EvaluateCompliance(context.Background(), "t", models.EvaluateComplianceRequest{PolicyID: "p-1"}); err == nil {
		t.Fatal("a failed report write was reported as a successful evaluation")
	}
}

// --- Trend ---

func TestPersistReportAndScoreDerivesTheTrendFromThePreviousScore(t *testing.T) {
	cases := []struct {
		name  string
		prev  *models.ComplianceScore
		score float64
		want  string
	}{
		{"none", nil, 60, "new"},
		{"better", &models.ComplianceScore{OverallScore: 40}, 60, "improving"},
		{"worse", &models.ComplianceScore{OverallScore: 90}, 60, "declining"},
		{"equal", &models.ComplianceScore{OverallScore: 60}, 60, "stable"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := &repoFake{prevScore: tc.prev}
			newSvc(r).persistReportAndScore(context.Background(), "t",
				&models.CompliancePolicy{ID: "p", Name: "n", Framework: "soc2"},
				&models.ComplianceEvaluationResult{PolicyID: "p", Status: "partial", Score: tc.score, EvaluatedAt: time.Now().UTC()})
			if got := r.scores[len(r.scores)-1].Trend; got != tc.want {
				t.Fatalf("trend = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestPersistReportAndScoreAbortsOnAnUnrelatedPreviousScoreError(t *testing.T) {
	svc := newSvc(&repoFake{prevScoreErr: errors.New("disk full")})
	if err := svc.persistReportAndScore(context.Background(), "t",
		&models.CompliancePolicy{ID: "p", Name: "n", Framework: "soc2"},
		&models.ComplianceEvaluationResult{PolicyID: "p", Status: "partial", Score: 60, EvaluatedAt: time.Now().UTC()}); err == nil {
		t.Fatal("a previous-score read failure was swallowed")
	}
}

// --- Score ---

func TestGetComplianceScoreReportsNewWhenTheTenantHasNeverBeenMeasured(t *testing.T) {
	score, err := newSvc(&repoFake{}).GetComplianceScore(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("GetComplianceScore: %v", err)
	}
	if score.Trend != "new" {
		t.Fatalf("trend = %q, want new — stable is an invention for a tenant with no data", score.Trend)
	}
	if score.CategoryScores == nil || len(score.CategoryScores) != 0 {
		t.Fatalf("categoryScores = %v, want an empty non-nil map", score.CategoryScores)
	}
}

func TestGetComplianceScorePassesStoredScoresThrough(t *testing.T) {
	score, err := newSvc(&repoFake{prevScore: &models.ComplianceScore{OverallScore: 77.5, Trend: "improving"}}).
		GetComplianceScore(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("GetComplianceScore: %v", err)
	}
	if score.OverallScore != 77.5 || score.Trend != "improving" {
		t.Fatalf("score = %+v", score)
	}
}

// --- Audit execution ---

func TestExecuteAuditRejectsAPlanThatDoesNotExist(t *testing.T) {
	r := &repoFake{}
	_, err := newSvc(r).ExecuteAudit(context.Background(), "tenant-1", "nope")
	if err == nil {
		t.Fatal("auditing a missing plan succeeded; the id was never validated")
	}
	if !errors.Is(err, ErrPlanNotExists) || !IsNotFound(err) {
		t.Fatalf("error %v must satisfy both errors.Is(err, ErrPlanNotExists) and IsNotFound(err)", err)
	}
	if len(r.executions) != 0 {
		t.Fatalf("an execution row was created for an audit that never ran: %v", r.executions)
	}
}

func TestExecuteAuditRunsEveryPolicyAndRecordsWhatItActuallyDid(t *testing.T) {
	r := &repoFake{
		policies: map[string]*models.CompliancePolicy{
			"p-1": {ID: "p-1", TenantID: "tenant-1", Name: "SOC2", Framework: "soc2"},
			"p-2": {ID: "p-2", TenantID: "tenant-1", Name: "CIS", Framework: "cis"},
		},
		auditPlans: []*models.AuditPlan{{ID: "plan-1", TenantID: "tenant-1", Name: "quarterly"}},
	}
	svc := newSvc(r)
	exec, err := svc.ExecuteAudit(context.Background(), "tenant-1", "plan-1")
	if err != nil {
		t.Fatalf("ExecuteAudit: %v", err)
	}
	r.assertTenant(t, "tenant-1")

	if r.policiesLimit != 1000 || r.policiesOffset != 0 {
		t.Fatalf("policies listed with (%d,%d), want (1000,0)", r.policiesLimit, r.policiesOffset)
	}
	if len(r.evaluations) != 2 {
		t.Fatalf("audited %d policies, want 2", len(r.evaluations))
	}
	if len(r.findings) == 0 {
		t.Fatal("the audit produced no findings, so GET /audit/:id/findings stays empty forever")
	}
	if r.auditReport == nil {
		t.Fatal("the audit did not persist a report")
	}
	if r.auditReport.FindingsCount != len(r.findings) {
		t.Fatalf("report findings_count = %d but %d findings were inserted", r.auditReport.FindingsCount, len(r.findings))
	}
	for _, f := range r.findings {
		if f.ReportID != r.auditReport.ID {
			t.Fatalf("finding %s links to report %s, want %s", f.ID, f.ReportID, r.auditReport.ID)
		}
	}

	if exec.Status != "completed" || exec.EndedAt == nil {
		t.Fatalf("execution = %+v", exec)
	}
	var summary map[string]any
	if err := json.Unmarshal([]byte(exec.Result), &summary); err != nil {
		t.Fatalf("execution result is not JSON: %v\n%s", err, exec.Result)
	}
	if int(summary["policies"].(float64)) != 2 || int(summary["findings"].(float64)) != len(r.findings) {
		t.Fatalf("summary = %v, findings = %d", summary, len(r.findings))
	}
	if summary["completed"] != true {
		t.Fatalf("summary reports completed = %v", summary["completed"])
	}
	if exec.Result != r.executions[0].Result {
		t.Fatalf("the returned execution disagrees with the persisted one")
	}
}

func TestExecuteAuditMarksTheExecutionFailedWhenAStepDies(t *testing.T) {
	stages := []struct {
		name   string
		repo   *repoFake
		policy bool
	}{
		{"listPolicies", &repoFake{listPoliciesErr: errors.New("scan failure"), auditPlans: []*models.AuditPlan{{ID: "plan-1", Name: "q"}}}, false},
		{"evaluate", &repoFake{policies: map[string]*models.CompliancePolicy{"p-1": {ID: "p-1", TenantID: "t", Name: "n", Framework: "soc2"}}, evalErr: errors.New("write failure"), auditPlans: []*models.AuditPlan{{ID: "plan-1", Name: "q"}}}, false},
		{"createReport", &repoFake{policies: map[string]*models.CompliancePolicy{"p-1": {ID: "p-1", TenantID: "t", Name: "n", Framework: "soc2"}}, reportInsertErr: errors.New("insert failure"), auditPlans: []*models.AuditPlan{{ID: "plan-1", Name: "q"}}}, false},
		{"createFinding", &repoFake{policies: map[string]*models.CompliancePolicy{"p-1": {ID: "p-1", TenantID: "t", Name: "n", Framework: "soc2"}}, findingsErr: errors.New("insert failure"), auditPlans: []*models.AuditPlan{{ID: "plan-1", Name: "q"}}}, false},
	}
	for _, tc := range stages {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := newSvc(tc.repo).ExecuteAudit(context.Background(), "t", "plan-1"); err == nil {
				t.Fatalf("stage %s reported success", tc.name)
			}
			if len(tc.repo.executions) != 1 {
				t.Fatalf("stage %s created %d execution rows", tc.name, len(tc.repo.executions))
			}
			if got := tc.repo.executions[0].Status; got != "failed" {
				t.Fatalf("stage %s left the execution in %q; a died audit must read as failed, not running", tc.name, got)
			}
		})
	}
}

func TestExecuteAuditFailureLeavesNoReport(t *testing.T) {
	r := &repoFake{
		policies:    map[string]*models.CompliancePolicy{"p-1": {ID: "p-1", TenantID: "t", Name: "n", Framework: "soc2"}},
		findingsErr: errors.New("boom"),
		auditPlans:  []*models.AuditPlan{{ID: "plan-1", Name: "q"}},
	}
	if _, err := newSvc(r).ExecuteAudit(context.Background(), "t", "plan-1"); err == nil {
		t.Fatal("want an error")
	}
	if r.auditReport != nil {
		t.Fatalf("a partial audit persisted a report: %+v", r.auditReport)
	}
}

// --- auditFindings / resolveFramework ---

func TestAuditFindingsComeFromTheControlCatalog(t *testing.T) {
	fw := resolveFramework("soc2")
	if len(fw.controls) == 0 {
		t.Fatal("the SOC2 catalog is empty; the test would be vacuous")
	}
	got := auditFindings(fw, defaultTargets)
	if len(got) == 0 {
		t.Fatal("no findings were derived from in-scope controls")
	}
	// Every finding must be a real catalog control, open, and scoped to at
	// least one target.
	titles := map[string]bool{}
	for _, f := range got {
		if f.Target == "" {
			t.Errorf("finding %q has no target", f.Title)
		}
		if f.Status != "open" {
			t.Errorf("finding %q status = %q", f.Title, f.Status)
		}
		if f.Severity != "low" {
			t.Errorf("finding %q severity = %q, want low: every built-in control is partial", f.Title, f.Severity)
		}
		if !strings.Contains(f.Title, " ") {
			t.Errorf("title %q is not controlID + controlName", f.Title)
		}
		titles[f.Title] = true
	}
	if titles["CC6.1 Logical & Physical Access"] != true {
		t.Errorf("the access control is missing from the findings: %v", titles)
	}
}

func TestAuditFindingsEscalateUnimplementedControlsToHigh(t *testing.T) {
	fw := frameworkDefinition{name: "t", controls: []rule{
		{controlID: "A.1", controlName: "Access Control", verdict: "partial", warnings: []string{"w"}},
		{controlID: "A.2", controlName: "Asset Inventory", verdict: "not_implemented", warnings: []string{"w2"}},
		{controlID: "A.3", controlName: "Unrelated", verdict: "partial", warnings: nil},
	}}
	got := auditFindings(fw, []string{"iam"})
	if len(got) != 1 {
		t.Fatalf("got %d findings, want 1 (only the access control is in scope)", len(got))
	}
	if got[0].Severity != "low" || got[0].Title != "A.1 Access Control" {
		t.Fatalf("finding = %+v", got[0])
	}
	got = auditFindings(fw, []string{"data-protection"})
	if len(got) != 1 {
		t.Fatalf("got %d findings for data-protection, want 1", len(got))
	}
	if got[0].Severity != "high" {
		t.Fatalf("not_implemented finding severity = %q, want high", got[0].Severity)
	}
	if got[0].Target != "data-protection" || got[0].Description != "w2" {
		t.Fatalf("finding = %+v", got[0])
	}
}

func TestResolveFrameworkFallsBackToSOC2ForEmptyAndUnknownNames(t *testing.T) {
	for _, name := range []string{"", "made-up", "SOC2", "Soc2"} {
		if got := resolveFramework(name).name; got != "SOC2" {
			t.Errorf("resolveFramework(%q) = %q, want SOC2", name, got)
		}
	}
	if got := resolveFramework("ISO27001").name; got != "ISO 27001" {
		t.Errorf("resolveFramework(ISO27001) = %q", got)
	}
}

func TestEvaluateDoesNotPanicWhenAControlHasNoWarningText(t *testing.T) {
	// evaluateTargetAgainstRules used to index r.warnings[0] unconditionally.
	// iso27001 A.5.2 and nist-csf GV.OC both declare nil warnings, so one
	// catalog edit away the whole service process would die with an
	// index-out-of-range panic the moment a target matched them.
	score, _, warnings := evaluateTargetAgainstRules("iam", []rule{
		{controlID: "A.5.2", controlName: "Access Roles", verdict: "partial", warnings: nil},
	})
	if score != 50 {
		t.Fatalf("score = %v, want 50", score)
	}
	if len(warnings) != 1 || !strings.Contains(warnings[0], "A.5.2") {
		t.Fatalf("warnings = %v", warnings)
	}
}

func TestEvaluateEveryFrameworkAgainstEveryTarget(t *testing.T) {
	for _, name := range builtInFrameworkNames() {
		fw := resolveFramework(name)
		for _, target := range defaultTargets {
			if _, _, _ = evaluateTargetAgainstRules(target, fw.controls); true {
				// exercised below
			}
		}
		if len(FrameworkControlIDs(name)) == 0 {
			t.Fatalf("framework %s exposes no controls", name)
		}
	}
}

func TestFrameworkControlIDsReturnsOneIDPerControl(t *testing.T) {
	ids := FrameworkControlIDs("soc2")
	if len(ids) != len(resolveFramework("soc2").controls) {
		t.Fatalf("returned %d ids for %d controls", len(ids), len(resolveFramework("soc2").controls))
	}
	if ids[0] != "CC1.1" {
		t.Fatalf("first id = %q", ids[0])
	}
	unknown := FrameworkControlIDs("does-not-exist")
	if len(unknown) != len(resolveFramework("soc2").controls) {
		t.Fatalf("unknown framework returned %d ids", len(unknown))
	}
}

// --- Last evaluation ---

func TestGetLastEvaluationReturnsNilOnMissAndTheRowOtherwise(t *testing.T) {
	want := &models.ComplianceEvaluationResult{PolicyID: "p-1", Status: "partial", Score: 62}
	got, err := newSvc(&repoFake{latestByPolicy: want}).GetLastEvaluation(context.Background(), "tenant-1", "p-1")
	if err != nil {
		t.Fatalf("GetLastEvaluation: %v", err)
	}
	if got == nil || got.Score != 62 {
		t.Fatalf("got = %v", got)
	}

	got, err = newSvc(&repoFake{}).GetLastEvaluation(context.Background(), "tenant-1", "p-1")
	if err != nil {
		t.Fatalf("a never-evaluated policy must not be an error: %v", err)
	}
	if got != nil {
		t.Fatalf("got %v, want nil", got)
	}

	if _, err := newSvc(&repoFake{latestErr: errors.New("scan error")}).GetLastEvaluation(context.Background(), "tenant-1", "p-1"); err == nil {
		t.Fatal("a store error was converted into an empty result")
	}
}

// --- Findings ---

func TestListFindingsPassesTheTenantThrough(t *testing.T) {
	r := &repoFake{listFindings: []models.AuditFinding{{ID: "f-1", TenantID: "tenant-1"}}}
	got, err := newSvc(r).ListFindings(context.Background(), "tenant-1", 20, 40)
	if err != nil {
		t.Fatalf("ListFindings: %v", err)
	}
	if len(got) != 1 || got[0].ID != "f-1" {
		t.Fatalf("got = %v", got)
	}
	r.assertTenant(t, "tenant-1")
}

func TestCloseFindingPersistsTheReason(t *testing.T) {
	r := &repoFake{}
	if err := newSvc(r).CloseFinding(context.Background(), "tenant-1", "f-1", "remediated"); err != nil {
		t.Fatalf("CloseFinding: %v", err)
	}
	if len(r.closed) != 1 || r.closed[0].reason != "remediated" || r.closed[0].id != "f-1" {
		t.Fatalf("close recorded %v", r.closed)
	}
	if !IsNotFound(newSvc(&repoFake{closeErr: fmt.Errorf("x: %w", sentinel.NotFound)}).CloseFinding(context.Background(), "t", "f", "r")) {
		t.Fatal("a not-found close is not visible to IsNotFound")
	}
}

// --- Gap analysis ---

func TestPerformGapAnalysisRejectsCallerErrorsAsBadRequest(t *testing.T) {
	svc := newSvc(&repoFake{})
	if _, err := svc.PerformGapAnalysis(context.Background(), "t", models.GapAnalysisRequest{}); !errors.Is(err, sentinel.BadRequest) {
		t.Fatalf("empty framework gave %v, want sentinel.BadRequest", err)
	}
	if _, err := svc.PerformGapAnalysis(context.Background(), "t", models.GapAnalysisRequest{Framework: "made-up"}); !errors.Is(err, sentinel.BadRequest) {
		t.Fatalf("unknown framework gave %v, want sentinel.BadRequest", err)
	}
}

func TestPerformGapAnalysisCountsEveryControl(t *testing.T) {
	r := &repoFake{}
	res, err := newSvc(r).PerformGapAnalysis(context.Background(), "tenant-1", models.GapAnalysisRequest{Framework: "pci-dss"})
	if err != nil {
		t.Fatalf("PerformGapAnalysis: %v", err)
	}
	want := len(resolveFramework("pci-dss").controls)
	if res.TotalControls != want || len(res.Gaps) != want {
		t.Fatalf("total = %d gaps = %d, want %d", res.TotalControls, len(res.Gaps), want)
	}
	if res.Implemented+res.Partial+res.NotImplemented != res.TotalControls {
		t.Fatalf("buckets %d+%d+%d do not cover %d controls", res.Implemented, res.Partial, res.NotImplemented, res.TotalControls)
	}
	if res.Framework != "PCI-DSS" {
		t.Fatalf("framework = %q", res.Framework)
	}
	for _, g := range res.Gaps {
		if g.Compliance == "" || g.Recommendation == "" {
			t.Fatalf("gap %q is incomplete: %+v", g.ControlID, g)
		}
	}
	r.assertTenant(t, "tenant-1")
	if len(r.gapResults) != 1 {
		t.Fatalf("gap analysis was not persisted: %v", r.gapResults)
	}
}

func TestPerformGapAnalysisUnscopableControlsBecomeGaps(t *testing.T) {
	res, err := newSvc(&repoFake{}).PerformGapAnalysis(context.Background(), "t",
		models.GapAnalysisRequest{Framework: "soc2", Targets: []string{"unknown-target"}})
	if err != nil {
		t.Fatalf("PerformGapAnalysis: %v", err)
	}
	if res.NotImplemented != res.TotalControls {
		t.Fatalf("every control must be unimplemented for an unmapped target: implemented %d partial %d not_implemented %d of %d",
			res.Implemented, res.Partial, res.NotImplemented, res.TotalControls)
	}
}

// --- Evidence and remediation ---

func TestCollectEvidenceRequiresAnExistingPolicy(t *testing.T) {
	_, err := newSvc(&repoFake{}).CollectEvidence(context.Background(), "t", models.CollectEvidenceRequest{PolicyID: "nope"})
	if !errors.Is(err, ErrPolicyNotExists) || !IsNotFound(err) {
		t.Fatalf("error %v must satisfy both the specific and the generic sentinel", err)
	}
}

func TestCollectEvidenceWritesOneRowPerSource(t *testing.T) {
	r := &repoFake{policies: map[string]*models.CompliancePolicy{"p-1": {ID: "p-1", TenantID: "t"}}}
	out, err := newSvc(r).CollectEvidence(context.Background(), "t", models.CollectEvidenceRequest{PolicyID: "p-1", Sources: []string{"s1", "s2"}})
	if err != nil {
		t.Fatalf("CollectEvidence: %v", err)
	}
	if out.Count != 2 || len(out.Evidence) != 2 || len(r.collected) != 2 {
		t.Fatalf("collected = %v / %d rows", out.Evidence, len(r.collected))
	}
	for _, e := range r.collected {
		if e.PolicyID != "p-1" || e.Source == "" || e.TenantID != "t" {
			t.Fatalf("evidence row = %+v", e)
		}
	}
}

func TestCollectEvidenceDefaultsToTheDefaultSource(t *testing.T) {
	r := &repoFake{policies: map[string]*models.CompliancePolicy{"p-1": {ID: "p-1", TenantID: "t"}}}
	out, err := newSvc(r).CollectEvidence(context.Background(), "t", models.CollectEvidenceRequest{PolicyID: "p-1"})
	if err != nil {
		t.Fatalf("CollectEvidence: %v", err)
	}
	if out.Count != 1 || r.collected[0].Source != "default" {
		t.Fatalf("collected = %+v", r.collected)
	}
}

func TestAutoRemediateRoutesKnownActionsThroughTheRegistry(t *testing.T) {
	svc := newSvc(&repoFake{policies: map[string]*models.CompliancePolicy{"p-1": {ID: "p-1", TenantID: "t"}}})
	res, err := svc.AutoRemediateCompliance(context.Background(), "t", models.RemediationRequest{PolicyID: "p-1", Actions: []string{"CC6.1", "not-a-real-action"}})
	if err != nil {
		t.Fatalf("AutoRemediateCompliance: %v", err)
	}
	if len(res.Applied) != 1 || !strings.Contains(res.Applied[0], "CC6.1") {
		t.Fatalf("applied = %v", res.Applied)
	}
	if len(res.Skipped) != 1 || !strings.Contains(res.Skipped[0], "not-a-real-action") {
		t.Fatalf("skipped = %v", res.Skipped)
	}
}

func TestAutoRemediateOfAnUnknownPolicyDoesNotRemediateAnything(t *testing.T) {
	r := &repoFake{}
	_, err := newSvc(r).AutoRemediateCompliance(context.Background(), "t", models.RemediationRequest{PolicyID: "nope"})
	if !errors.Is(err, ErrPolicyNotExists) {
		t.Fatalf("error = %v", err)
	}
	if len(r.evaluations) != 0 {
		t.Fatalf("an unknown policy was still evaluated: %v", r.evaluations)
	}
}

// --- Frameworks ---

func TestGetFrameworksWrapsRepositoryRows(t *testing.T) {
	r := &repoFake{frameworks: []models.ComplianceFramework{{ID: "fw-1", TenantID: "t", Name: "SOC2"}}}
	got, err := newSvc(r).GetFrameworks(context.Background(), "t")
	if err != nil {
		t.Fatalf("GetFrameworks: %v", err)
	}
	if len(got.Frameworks) != 1 || got.Frameworks[0].ID != "fw-1" {
		t.Fatalf("got = %+v", got)
	}
}

func TestGetFrameworkMapsNotFound(t *testing.T) {
	_, err := newSvc(&repoFake{}).GetFramework(context.Background(), "t", "nope")
	if !IsNotFound(err) {
		t.Fatalf("error = %v", err)
	}
}

// --- Reports ---

func TestGetComplianceReportMapsNotFoundAndPassesThroughData(t *testing.T) {
	_, err := newSvc(&repoFake{}).GetComplianceReport(context.Background(), "t", "p-1")
	if !IsNotFound(err) {
		t.Fatalf("missing report gave %v", err)
	}

	want := &models.ComplianceReport{ID: "cr-1", PolicyID: "p-1", Name: "n", Framework: "soc2", Status: "partial", Score: 50}
	r := &repoFake{reports: []*models.ComplianceReport{want}}
	got, err := newSvc(r).GetComplianceReport(context.Background(), "t", "p-1")
	if err != nil {
		t.Fatalf("GetComplianceReport: %v", err)
	}
	if got.ID != "cr-1" {
		t.Fatalf("got = %+v", got)
	}
}

func TestGetAuditReportMapsNotFound(t *testing.T) {
	_, err := newSvc(&repoFake{}).GetAuditReport(context.Background(), "t", "e-1")
	if !IsNotFound(err) {
		t.Fatalf("error = %v", err)
	}
	if got, err := newSvc(&repoFake{auditReport: &models.AuditReport{ID: "ar-1", FindingsCount: 3}}).GetAuditReport(context.Background(), "t", "e-1"); err != nil || got.FindingsCount != 3 {
		t.Fatalf("stored report = %+v / %v", got, err)
	}
}

func TestGetAuditFindingsReturnsTheReportFindings(t *testing.T) {
	r := &repoFake{auditReport: &models.AuditReport{ID: "ar-1"}}
	r.findings = []*models.AuditFinding{{ID: "f-1", ReportID: "ar-1"}}
	got, err := newSvc(r).GetAuditFindings(context.Background(), "t", "ar-1")
	if err != nil {
		t.Fatalf("GetAuditFindings: %v", err)
	}
	if len(got) != 1 || got[0].ID != "f-1" {
		t.Fatalf("got = %v", got)
	}
	none, err := newSvc(r).GetAuditFindings(context.Background(), "t", "other-report")
	if err != nil || len(none) != 0 {
		t.Fatalf("wrong report gave %v / %v", none, err)
	}
}

// --- Pure helpers ---

func TestJoinEvaluation(t *testing.T) {
	if got := joinEvaluation(nil, nil); got != "" {
		t.Errorf("empty = %q, want empty", got)
	}
	got := joinEvaluation([]string{"f1"}, []string{"w1", "w2"})
	var decoded []string
	if err := json.Unmarshal([]byte(got), &decoded); err != nil {
		t.Fatalf("not JSON: %v\n%s", err, got)
	}
	if len(decoded) != 3 || decoded[0] != "f1" || decoded[2] != "w2" {
		t.Fatalf("decoded = %v", decoded)
	}
}

func TestFirstNonEmpty(t *testing.T) {
	if firstNonEmpty("", "", "") != "" {
		t.Error("all-empty returned something")
	}
	if firstNonEmpty("", "b", "c") != "b" {
		t.Error("did not return the first non-empty value")
	}
	if firstNonEmpty("a", "b") != "a" {
		t.Error("did not prefer the first value")
	}
}

func TestDefinePolicyAndCreateAuditPlanStampTheTenant(t *testing.T) {
	r := &repoFake{}
	p, err := newSvc(r).DefinePolicy(context.Background(), "tenant-9", models.CreatePolicyRequest{Name: "n", Framework: "soc2", Rules: "[]"})
	if err != nil {
		t.Fatalf("DefinePolicy: %v", err)
	}
	if p.TenantID != "tenant-9" || p.Name != "n" {
		t.Fatalf("policy = %+v", p)
	}
	plan, err := newSvc(r).CreateAuditPlan(context.Background(), "tenant-9", models.CreateAuditPlanRequest{Name: "q", Schedule: "weekly"})
	if err != nil {
		t.Fatalf("CreateAuditPlan: %v", err)
	}
	if plan.TenantID != "tenant-9" || plan.Schedule != "weekly" {
		t.Fatalf("plan = %+v", plan)
	}
	r.assertTenant(t, "tenant-9")
}

func TestSentinelsMatchBothTheSpecificAndGenericChecks(t *testing.T) {
	for _, tc := range []struct {
		name string
		sent error
	}{
		{"policy", ErrPolicyNotExists},
		{"plan", ErrPlanNotExists},
	} {
		if !errors.Is(tc.sent, sentinel.NotFound) {
			t.Errorf("%s sentinel does not unwrap to sentinel.NotFound", tc.name)
		}
		if !IsNotFound(tc.sent) {
			t.Errorf("IsNotFound(%s) is false", tc.name)
		}
		if !errors.Is(fmt.Errorf("wrapped: %w", tc.sent), tc.sent) {
			t.Errorf("a wrapped %s sentinel is not reachable", tc.name)
		}
	}
}
