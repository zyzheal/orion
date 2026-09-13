package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/security-compliance/models"
	"orion/platform-svc-go/internal/security-compliance/service"

	"github.com/gin-gonic/gin"
)

func init() { gin.SetMode(gin.TestMode) }

// Handler tests drive a real *gin.Engine through ServeHTTP so the permission
// guards, the tenant guard and the status mapping all run. The previous file
// used gin.CreateTestContext with a second return value that does not exist,
// populated c.Params by hand (so every :id handler saw ""), and asserted only
// that the status code was below 500 — a 401, a 403, a 404, a 500 and a 200
// all passed, and none of the four bridge handlers was exercised at all.

const (
	hdrTenant = "X-Test-Tenant"
	hdrUser   = "X-Test-User"
	hdrRole   = "X-Test-Role"
)

var testNow = time.Date(2026, 8, 26, 10, 0, 0, 0, time.UTC)

type fakeService struct {
	calls   int
	tenants []string

	policies     []models.CompliancePolicy
	havePolicies bool
	listErr      error
	listLimit    int
	listOffset   int

	lastEval    *models.ComplianceEvaluationResult
	lastEvalErr error

	evaluateErr  error
	remediateErr error
	gapErr       error
	planErr      error
	auditErr     error
	closeErr     error
	reportErr    error

	findings    []models.AuditFinding
	findingsErr error

	createdName      string
	createdFramework string
	createdRules     string
}

func (f *fakeService) enter(tenantID string) {
	f.calls++
	f.tenants = append(f.tenants, tenantID)
}

func (f *fakeService) ListPolicies(ctx context.Context, tenantID string, limit, offset int) ([]models.CompliancePolicy, error) {
	f.enter(tenantID)
	f.listLimit, f.listOffset = limit, offset
	if f.listErr != nil {
		return nil, f.listErr
	}
	if f.havePolicies {
		return f.policies, nil
	}
	return []models.CompliancePolicy{
		{ID: "p-1", TenantID: tenantID, Name: "SOC2 baseline", Framework: "soc2", Rules: `["CC1.1","CC2.1"]`},
		{ID: "p-2", TenantID: tenantID, Name: "CIS baseline", Framework: "cis"},
	}, nil
}

func (f *fakeService) DefinePolicy(ctx context.Context, tenantID string, req models.CreatePolicyRequest) (*models.CompliancePolicy, error) {
	f.enter(tenantID)
	f.createdName, f.createdFramework, f.createdRules = req.Name, req.Framework, req.Rules
	return &models.CompliancePolicy{ID: "policy-new", TenantID: tenantID, Name: req.Name, Framework: req.Framework, Rules: req.Rules}, nil
}

func (f *fakeService) EvaluateCompliance(ctx context.Context, tenantID string, req models.EvaluateComplianceRequest) (*models.ComplianceEvaluationResult, error) {
	f.enter(tenantID)
	if f.evaluateErr != nil {
		return nil, f.evaluateErr
	}
	return &models.ComplianceEvaluationResult{
		PolicyID: req.PolicyID, Status: "partial", Score: 72.5,
		Failures: []string{"CC6.1 access review missing"}, Warnings: []string{"CC1.1 ethics policy not formalised"}, EvaluatedAt: testNow,
	}, nil
}

func (f *fakeService) GetComplianceReport(ctx context.Context, tenantID, policyID string) (*models.ComplianceReport, error) {
	f.enter(tenantID)
	if f.reportErr != nil {
		return nil, f.reportErr
	}
	return &models.ComplianceReport{ID: "r-1", TenantID: tenantID, PolicyID: policyID, Name: "report", Framework: "soc2", Status: "partial", Score: 72.5}, nil
}

func (f *fakeService) GetComplianceScore(ctx context.Context, tenantID string) (*models.ComplianceScore, error) {
	f.enter(tenantID)
	return &models.ComplianceScore{OverallScore: 72.5, CategoryScores: map[string]float64{"partial": 72.5}, Trend: "stable", LastUpdated: testNow}, nil
}

func (f *fakeService) AutoRemediateCompliance(ctx context.Context, tenantID string, req models.RemediationRequest) (*models.RemediationResult, error) {
	f.enter(tenantID)
	if f.remediateErr != nil {
		return nil, f.remediateErr
	}
	return &models.RemediationResult{Applied: []string{"a"}, Skipped: []string{}, Failures: []string{}}, nil
}

func (f *fakeService) GetFrameworks(ctx context.Context, tenantID string) (*models.FrameworkList, error) {
	f.enter(tenantID)
	return &models.FrameworkList{Frameworks: []models.ComplianceFramework{{ID: "fw-1", TenantID: tenantID, Name: "SOC2"}}}, nil
}

func (f *fakeService) GetFramework(ctx context.Context, tenantID, id string) (*models.ComplianceFramework, error) {
	f.enter(tenantID)
	return &models.ComplianceFramework{ID: id, TenantID: tenantID, Name: "SOC2"}, nil
}

func (f *fakeService) CollectEvidence(ctx context.Context, tenantID string, req models.CollectEvidenceRequest) (*models.EvidenceCollection, error) {
	f.enter(tenantID)
	return &models.EvidenceCollection{Evidence: []models.Evidence{{PolicyID: req.PolicyID}}, Count: 1}, nil
}

func (f *fakeService) GetEvidence(ctx context.Context, tenantID, policyID string) ([]models.Evidence, error) {
	f.enter(tenantID)
	return []models.Evidence{{ID: "e-1", TenantID: tenantID, PolicyID: policyID, Source: "default"}}, nil
}

func (f *fakeService) GenerateEvidenceCollection(ctx context.Context, tenantID string, req models.CollectEvidenceRequest) (*models.EvidenceCollection, error) {
	f.enter(tenantID)
	return &models.EvidenceCollection{Evidence: []models.Evidence{{PolicyID: req.PolicyID}}, Count: 1}, nil
}

func (f *fakeService) PerformGapAnalysis(ctx context.Context, tenantID string, req models.GapAnalysisRequest) (*models.GapAnalysisResult, error) {
	f.enter(tenantID)
	if f.gapErr != nil {
		return nil, f.gapErr
	}
	return &models.GapAnalysisResult{Framework: req.Framework, TotalControls: 10, Partial: 10, Gaps: []models.GapAnalysisItem{}}, nil
}

func (f *fakeService) ListAuditPlans(ctx context.Context, tenantID string, limit, offset int) ([]models.AuditPlan, error) {
	f.enter(tenantID)
	return []models.AuditPlan{{ID: "plan-1", TenantID: tenantID, Name: "quarterly", Status: "scheduled"}}, nil
}

func (f *fakeService) CreateAuditPlan(ctx context.Context, tenantID string, req models.CreateAuditPlanRequest) (*models.AuditPlan, error) {
	f.enter(tenantID)
	return &models.AuditPlan{ID: "plan-new", TenantID: tenantID, Name: req.Name, Status: "scheduled"}, nil
}

func (f *fakeService) ExecuteAudit(ctx context.Context, tenantID, planID string) (*models.AuditExecution, error) {
	f.enter(tenantID)
	if f.auditErr != nil {
		return nil, f.auditErr
	}
	return &models.AuditExecution{ID: "exec-1", PlanID: planID, TenantID: tenantID, Status: "completed"}, nil
}

func (f *fakeService) GetAuditReport(ctx context.Context, tenantID, executionID string) (*models.AuditReport, error) {
	f.enter(tenantID)
	return &models.AuditReport{ID: "ar-1", ExecutionID: executionID, TenantID: tenantID, FindingsCount: 3}, nil
}

func (f *fakeService) GetAuditFindings(ctx context.Context, tenantID, reportID string) ([]models.AuditFinding, error) {
	f.enter(tenantID)
	return []models.AuditFinding{{ID: "f-1", ReportID: reportID, TenantID: tenantID}}, nil
}

func (f *fakeService) findingsFor(tenantID string) []models.AuditFinding {
	if len(f.findings) > 0 {
		return f.findings
	}
	switch tenantID {
	case "tenant-1":
		return []models.AuditFinding{{
			ID: "f-1", ReportID: "r-1", TenantID: "tenant-1", Target: "iam",
			Severity: "high", Title: "CC6.1 Logical & Physical Access",
			Description: "Access review cycle length unknown.", Status: "open", CreatedAt: testNow,
		}}
	case "tenant-empty":
		return []models.AuditFinding{}
	default:
		return []models.AuditFinding{{
			ID: "f-9", ReportID: "r-9", TenantID: tenantID, Target: "networking",
			Severity: "low", Title: "CC7.1 System Operations", Status: "closed", CreatedAt: testNow,
		}}
	}
}

func (f *fakeService) ListFindings(ctx context.Context, tenantID string, limit, offset int) ([]models.AuditFinding, error) {
	f.enter(tenantID)
	if f.findingsErr != nil {
		return nil, f.findingsErr
	}
	return f.findingsFor(tenantID), nil
}

func (f *fakeService) GetLastEvaluation(ctx context.Context, tenantID, policyID string) (*models.ComplianceEvaluationResult, error) {
	f.enter(tenantID)
	if f.lastEvalErr != nil {
		return nil, f.lastEvalErr
	}
	return f.lastEval, nil
}

func (f *fakeService) CloseFinding(ctx context.Context, tenantID, findingID string, reason string) error {
	f.enter(tenantID)
	return f.closeErr
}

// headerSource stands in for the JWT middleware. It writes the exact context
// keys orion-go-common/pkg/auth writes and reads them per request, so one
// router serves every tenant and role combination. roles is a []string because
// that is the type auth.GetRoles expects.
func headerSource() gin.HandlerFunc {
	return func(c *gin.Context) {
		if v := c.GetHeader(hdrTenant); v != "" {
			c.Set("tenant_id", v)
		}
		if v := c.GetHeader(hdrUser); v != "" {
			c.Set("user_id", v)
		}
		if v := c.GetHeader(hdrRole); v != "" {
			roles := make([]string, 0, 4)
			for _, r := range strings.Split(v, ",") {
				if r = strings.TrimSpace(r); r != "" {
					roles = append(roles, r)
				}
			}
			c.Set("roles", roles)
		}
		c.Next()
	}
}

func buildRouter(svc *fakeService) *gin.Engine {
	e := gin.New()
	e.Use(headerSource())
	(&Handler{svc: svc}).RegisterRoutes(e.Group("/api/v1"))
	return e
}

func doReq(t *testing.T, e *gin.Engine, method, target, body string, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	var r *http.Request
	if body == "" {
		r, _ = http.NewRequest(method, target, nil)
	} else {
		r, _ = http.NewRequest(method, target, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		r.Header.Set(k, v)
	}
	rr := httptest.NewRecorder()
	e.ServeHTTP(rr, r)
	return rr
}

func envOf(t *testing.T, rr *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	if rr.Body.Len() == 0 {
		return map[string]any{}
	}
	var m map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &m); err != nil {
		t.Fatalf("response body is not JSON: %v\n%s", err, rr.Body.String())
	}
	return m
}

func listOf(t *testing.T, rr *httptest.ResponseRecorder) []map[string]any {
	t.Helper()
	env := envOf(t, rr)
	data, _ := env["data"].([]any)
	out := make([]map[string]any, 0, len(data))
	for _, item := range data {
		if m, ok := item.(map[string]any); ok {
			out = append(out, m)
		}
	}
	return out
}

func objectOf(t *testing.T, rr *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	m, ok := envOf(t, rr)["data"].(map[string]any)
	if !ok {
		t.Fatalf("data is not an object: %v", envOf(t, rr)["data"])
	}
	return m
}

func authHeader(tenant, role string) map[string]string {
	h := map[string]string{hdrTenant: tenant, hdrUser: "u-1"}
	if role != "" {
		h[hdrRole] = role
	}
	return h
}

// --- Route mounting ---

func TestRegistersAllTwentyTwoRoutes(t *testing.T) {
	e := buildRouter(&fakeService{})
	mounted := 0
	for _, r := range e.Routes() {
		if strings.Contains(r.Path, "/compliance") || strings.Contains(r.Path, "/audit") {
			mounted++
		}
	}
	if mounted != 22 {
		t.Fatalf("RegisterRoutes mounted %d routes, want 22", mounted)
	}
}

func TestEveryRouteHasAPermissionGuard(t *testing.T) {
	e := buildRouter(&fakeService{})
	for _, r := range e.Routes() {
		if !strings.Contains(r.Path, "/compliance") && !strings.Contains(r.Path, "/audit") {
			continue
		}
		// A route with no guard answers 403 from the permission middleware when
		// the request carries no role; one that is guarded here reaches the
		// handler and answers 401 from the tenant guard instead.
		rr := doReq(t, e, r.Method, r.Path, "", map[string]string{hdrUser: "u-1"})
		if rr.Code != http.StatusForbidden {
			t.Errorf("%s %s answered %d with no role; want 403", r.Method, r.Path, rr.Code)
		}
	}
}

// --- Tenant guard ---

func TestMissingTenantIsRejectedBeforeTheServiceIsCalled(t *testing.T) {
	targets := []struct{ method, path string }{
		{"GET", "/api/v1/compliance/policies"},
		{"GET", "/api/v1/compliance/score"},
		{"GET", "/api/v1/compliance/baselines"},
		{"GET", "/api/v1/compliance/findings"},
		{"GET", "/api/v1/audit/plans"},
		{"POST", "/api/v1/compliance/baselines/foo/scan"},
	}
	for _, tc := range targets {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			f := &fakeService{}
			e := buildRouter(f)
			h := map[string]string{hdrUser: "u-1", hdrRole: "admin"}
			if tc.method == "POST" && tc.path == "/api/v1/compliance/baselines" {
				h = authHeader("", "admin")
			}
			rr := doReq(t, e, tc.method, tc.path, `{"name":"x","framework":"soc2"}`, h)
			if rr.Code != http.StatusUnauthorized {
				t.Fatalf("got %d, want 401", rr.Code)
			}
			if f.calls != 0 {
				t.Fatalf("handler reached the service %d times with no tenant", f.calls)
			}
			if got := envOf(t, rr)["error"]; got != "tenant_id required" {
				t.Fatalf("error = %v, want the tenant message", got)
			}
		})
	}
}

// --- Status mapping ---

func TestNotFoundMapsTo404(t *testing.T) {
	cases := []struct {
		name   string
		method string
		path   string
		fake   func(*fakeService)
		body   string
	}{
		{"evaluate", "POST", "/api/v1/compliance/evaluate", func(f *fakeService) { f.evaluateErr = fmt.Errorf("policy %q: %w", "p-x", sentinel.NotFound) }, `{"policy_id":"p-x"}`},
		{"remediate", "POST", "/api/v1/compliance/remediate", func(f *fakeService) { f.remediateErr = fmt.Errorf("policy %q: %w", "p-x", sentinel.NotFound) }, `{"policy_id":"p-x"}`},
		{"report", "GET", "/api/v1/compliance/report/p-x", func(f *fakeService) {
			f.reportErr = fmt.Errorf("report for policy %q not found: %w", "p-x", sentinel.NotFound)
		}, ""},
		{"execute", "POST", "/api/v1/audit/p-x/execute", func(f *fakeService) { f.auditErr = fmt.Errorf("plan %q: %w", "p-x", sentinel.NotFound) }, ""},
		{"close", "POST", "/api/v1/audit/findings/f-x/close", func(f *fakeService) { f.closeErr = fmt.Errorf("finding %q: %w", "f-x", sentinel.NotFound) }, `{"reason":"fixed"}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := &fakeService{}
			tc.fake(f)
			e := buildRouter(f)
			rr := doReq(t, e, tc.method, tc.path, tc.body, authHeader("tenant-1", "admin"))
			if rr.Code != http.StatusNotFound {
				t.Fatalf("got %d, want 404 (%s)", rr.Code, rr.Body.String())
			}
		})
	}
}

func TestGapAnalysisBadRequestMapsTo400(t *testing.T) {
	f := &fakeService{gapErr: fmt.Errorf("unknown framework %q (supported: soc2): %w", "made-up", sentinel.BadRequest)}
	rr := doReq(t, buildRouter(f), "POST", "/api/v1/compliance/gap-analysis", `{"framework":"made-up"}`, authHeader("tenant-1", "admin"))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400", rr.Code)
	}
}

func TestGapAnalysisEmptyFrameworkIsABadRequestNotA500(t *testing.T) {
	f := &fakeService{gapErr: fmt.Errorf("gap analysis: framework is required: %w", sentinel.BadRequest)}
	rr := doReq(t, buildRouter(f), "POST", "/api/v1/compliance/gap-analysis", `{}`, authHeader("tenant-1", "admin"))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400", rr.Code)
	}
}

// --- Read paths ---

func TestListPoliciesReturnsTenantRows(t *testing.T) {
	f := &fakeService{}
	rr := doReq(t, buildRouter(f), "GET", "/api/v1/compliance/policies?limit=7&offset=3", "", authHeader("tenant-1", "admin"))
	if rr.Code != http.StatusOK {
		t.Fatalf("got %d: %s", rr.Code, rr.Body.String())
	}
	if len(listOf(t, rr)) != 2 {
		t.Fatalf("returned %d policies", len(listOf(t, rr)))
	}
	if f.listLimit != 7 || f.listOffset != 3 {
		t.Fatalf("pagination = (%d,%d), want (7,3)", f.listLimit, f.listOffset)
	}
	if len(f.tenants) != 1 || f.tenants[0] != "tenant-1" {
		t.Fatalf("service saw tenants %v", f.tenants)
	}
}

func TestGetComplianceScorePassesTheTenantThrough(t *testing.T) {
	f := &fakeService{}
	rr := doReq(t, buildRouter(f), "GET", "/api/v1/compliance/score", "", authHeader("tenant-7", "admin"))
	if rr.Code != http.StatusOK {
		t.Fatalf("got %d: %s", rr.Code, rr.Body.String())
	}
	if f.tenants[0] != "tenant-7" {
		t.Fatalf("service saw %v, want tenant-7", f.tenants)
	}
}

// --- Write paths ---

func TestDefinePolicyRequiresNameAndFramework(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	for _, body := range []string{"{}", `{"name":"x"}`, `{"framework":"soc2"}`, `{bad json`} {
		rr := doReq(t, e, "POST", "/api/v1/compliance/policies", body, authHeader("tenant-1", "admin"))
		if rr.Code != http.StatusBadRequest {
			t.Fatalf("body %s answered %d, want 400", body, rr.Code)
		}
	}
	if f.calls != 0 {
		t.Fatalf("rejected bodies reached the service %d times", f.calls)
	}
}

func TestCreateAuditPlanReturnsCreated(t *testing.T) {
	f := &fakeService{}
	rr := doReq(t, buildRouter(f), "POST", "/api/v1/audit/plans", `{"name":"quarterly"}`, authHeader("tenant-1", "admin"))
	if rr.Code != http.StatusCreated {
		t.Fatalf("got %d: %s", rr.Code, rr.Body.String())
	}
	if objectOf(t, rr)["id"] != "plan-new" {
		t.Fatalf("id = %v", objectOf(t, rr)["id"])
	}
}

// --- Compliance baselines (bridge) ---

func TestListBaselinesReportsTheRealRuleCountAndPassRate(t *testing.T) {
	f := &fakeService{
		havePolicies: true,
		policies: []models.CompliancePolicy{{
			ID: "p-1", TenantID: "tenant-1", Name: "SOC2 baseline", Framework: "soc2",
			Rules: `[{"controlId":"CC1.1"},{"controlId":"CC2.1"},{"controlId":"CC3.1"}]`,
		}},
		lastEval: &models.ComplianceEvaluationResult{PolicyID: "p-1", Status: "partial", Score: 61.25, EvaluatedAt: testNow},
	}
	rr := doReq(t, buildRouter(f), "GET", "/api/v1/compliance/baselines", "", authHeader("tenant-1", "admin"))
	if rr.Code != http.StatusOK {
		t.Fatalf("got %d: %s", rr.Code, rr.Body.String())
	}
	list := listOf(t, rr)
	if len(list) != 1 {
		t.Fatalf("returned %d baselines: %s", len(list), rr.Body.String())
	}
	b := list[0]
	if int(b["rules"].(float64)) != 3 {
		t.Fatalf("rules = %v, want 3", b["rules"])
	}
	if b["passRate"] != float64(61.25) {
		t.Fatalf("passRate = %v, want 61.25", b["passRate"])
	}
	if b["lastScan"] != testNow.Format(time.RFC3339) {
		t.Fatalf("lastScan = %v", b["lastScan"])
	}
}

func TestListBaselinesDoesNotInventDataWhenTheTenantHasNone(t *testing.T) {
	f := &fakeService{havePolicies: true, policies: []models.CompliancePolicy{}}
	rr := doReq(t, buildRouter(f), "GET", "/api/v1/compliance/baselines", "", authHeader("tenant-empty", "admin"))
	if rr.Code != http.StatusOK {
		t.Fatalf("got %d: %s", rr.Code, rr.Body.String())
	}
	list := listOf(t, rr)
	if len(list) != 0 {
		t.Fatalf("returned %d fabricated baselines for an empty tenant", len(list))
	}
}

func TestListBaselinesSurfacesRepositoryErrors(t *testing.T) {
	f := &fakeService{listErr: fmt.Errorf("relation compliance_policies does not exist")}
	rr := doReq(t, buildRouter(f), "GET", "/api/v1/compliance/baselines", "", authHeader("tenant-1", "admin"))
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("got %d, want 500 — the error used to be masked by the demo list", rr.Code)
	}
}

func TestListBaselinesPolicyWithoutAnEvaluationHasNoLastScan(t *testing.T) {
	f := &fakeService{
		havePolicies: true,
		policies:     []models.CompliancePolicy{{ID: "p-1", TenantID: "tenant-1", Name: "new", Framework: "soc2", Rules: `[]`}},
	}
	rr := doReq(t, buildRouter(f), "GET", "/api/v1/compliance/baselines", "", authHeader("tenant-1", "admin"))
	if rr.Code != http.StatusOK {
		t.Fatalf("got %d: %s", rr.Code, rr.Body.String())
	}
	b := listOf(t, rr)[0]
	if _, present := b["lastScan"]; present {
		t.Fatalf("lastScan present for a never-evaluated policy: %v", b["lastScan"])
	}
	if b["passRate"] != float64(0) {
		t.Fatalf("passRate = %v, want 0", b["passRate"])
	}
	if int(b["rules"].(float64)) != 0 {
		t.Fatalf("rules = %v, want 0", b["rules"])
	}
}

func TestListBaselinesEvaluationFailureIsAnError(t *testing.T) {
	f := &fakeService{
		havePolicies: true,
		policies:     []models.CompliancePolicy{{ID: "p-1", TenantID: "tenant-1", Name: "n", Framework: "soc2"}},
		lastEvalErr:  fmt.Errorf("broken"),
	}
	rr := doReq(t, buildRouter(f), "GET", "/api/v1/compliance/baselines", "", authHeader("tenant-1", "admin"))
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("got %d, want 500", rr.Code)
	}
}

func TestCreateBaselinePersistsThePolicyWithItsRealControlCount(t *testing.T) {
	f := &fakeService{}
	rr := doReq(t, buildRouter(f), "POST", "/api/v1/compliance/baselines", `{"name":"SOC2 baseline","framework":"soc2"}`, authHeader("tenant-1", "admin"))
	if rr.Code != http.StatusCreated {
		t.Fatalf("got %d: %s", rr.Code, rr.Body.String())
	}
	want := len(service.FrameworkControlIDs("soc2"))
	if want == 0 {
		t.Fatalf("framework control catalog is empty; the test would be vacuous")
	}
	data := objectOf(t, rr)
	if int(data["rules"].(float64)) != want {
		t.Fatalf("rules = %v, want the %d controls of the framework", data["rules"], want)
	}
	if _, present := data["lastScan"]; present {
		t.Fatalf("a never-scanned baseline reports lastScan: %v", data["lastScan"])
	}
	if data["id"] != "policy-new" {
		t.Fatalf("id = %v, want the persisted policy id", data["id"])
	}
	if f.createdFramework != "soc2" || f.createdName != "SOC2 baseline" {
		t.Fatalf("persisted (name=%q framework=%q)", f.createdName, f.createdFramework)
	}
	var ids []string
	if err := json.Unmarshal([]byte(f.createdRules), &ids); err != nil {
		t.Fatalf("persisted rules are not a JSON array: %v\n%s", err, f.createdRules)
	}
	if len(ids) != want {
		t.Fatalf("persisted %d rules, want %d", len(ids), want)
	}
}

func TestCreateBaselineRequiresNameAndFramework(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)
	for _, body := range []string{"{}", `{"name":"x"}`, `{"framework":"soc2"}`} {
		rr := doReq(t, e, "POST", "/api/v1/compliance/baselines", body, authHeader("tenant-1", "admin"))
		if rr.Code != http.StatusBadRequest {
			t.Fatalf("body %s answered %d, want 400", body, rr.Code)
		}
	}
	if f.calls != 0 {
		t.Fatalf("rejected bodies reached the service %d times", f.calls)
	}
}

func TestScanBaselineSuccessReportsTheScanOutcomeAndTheVerdictSeparately(t *testing.T) {
	f := &fakeService{}
	rr := doReq(t, buildRouter(f), "POST", "/api/v1/compliance/baselines/p-1/scan", "", authHeader("tenant-1", "admin"))
	if rr.Code != http.StatusOK {
		t.Fatalf("got %d: %s", rr.Code, rr.Body.String())
	}
	data := objectOf(t, rr)
	if data["status"] != "completed" {
		t.Fatalf("status = %v", data["status"])
	}
	if data["verdict"] != "partial" {
		t.Fatalf("verdict = %v", data["verdict"])
	}
	if data["score"] != float64(72.5) {
		t.Fatalf("score = %v", data["score"])
	}
	if data["baselineId"] != "p-1" {
		t.Fatalf("baselineId = %v", data["baselineId"])
	}
	if f.tenants[0] != "tenant-1" {
		t.Fatalf("service saw %v", f.tenants)
	}
}

func TestScanBaselineFailureNeverClaimsCompleted(t *testing.T) {
	f := &fakeService{evaluateErr: fmt.Errorf("relation compliance_evaluation_results does not exist")}
	rr := doReq(t, buildRouter(f), "POST", "/api/v1/compliance/baselines/p-1/scan", "", authHeader("tenant-1", "admin"))
	if rr.Code == http.StatusOK {
		t.Fatalf("scan failure answered 200: %s", rr.Body.String())
	}
	env := envOf(t, rr)
	if env["success"] == true {
		t.Fatalf("scan failure reported success=true: %s", rr.Body.String())
	}
	if data, ok := env["data"].(map[string]any); ok && data["status"] == "completed" {
		t.Fatalf("scan failure body still claims completed: %s", rr.Body.String())
	}
}

func TestScanBaselineUnknownPolicyIsA404(t *testing.T) {
	f := &fakeService{evaluateErr: fmt.Errorf("policy %q: %w", "p-x", sentinel.NotFound)}
	rr := doReq(t, buildRouter(f), "POST", "/api/v1/compliance/baselines/p-x/scan", "", authHeader("tenant-1", "admin"))
	if rr.Code != http.StatusNotFound {
		t.Fatalf("got %d, want 404", rr.Code)
	}
}

func TestScanBaselineRejectsAnEmptyIDWithoutCallingTheService(t *testing.T) {
	f := &fakeService{}
	h := NewHandler(f)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest("POST", "/api/v1/compliance/baselines//scan", nil)
	c.Set("tenant_id", "tenant-1")
	h.ScanBaseline(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("got %d, want 400", w.Code)
	}
	if f.calls != 0 {
		t.Fatalf("empty id reached the service %d times", f.calls)
	}
}

// --- Compliance findings (bridge) ---

func TestListFindingsReturnsOnlyTheRequestingTenantRows(t *testing.T) {
	f := &fakeService{}
	e := buildRouter(f)

	rr := doReq(t, e, "GET", "/api/v1/compliance/findings", "", authHeader("tenant-1", "admin"))
	if rr.Code != http.StatusOK {
		t.Fatalf("got %d: %s", rr.Code, rr.Body.String())
	}
	list := listOf(t, rr)
	if len(list) != 1 {
		t.Fatalf("returned %d findings: %s", len(list), rr.Body.String())
	}
	got := list[0]
	if got["id"] != "f-1" {
		t.Fatalf("id = %v", got["id"])
	}
	if got["rule"] != "CC6.1 Logical & Physical Access" {
		t.Fatalf("rule = %v, want the finding title", got["rule"])
	}
	if got["target"] != "iam" {
		t.Fatalf("target = %v", got["target"])
	}
	if got["level"] != "high" {
		t.Fatalf("level = %v", got["level"])
	}
	if got["status"] != "pending" {
		t.Fatalf("status = %v, want open mapped to pending", got["status"])
	}
	if got["description"] != "Access review cycle length unknown." {
		t.Fatalf("description = %v", got["description"])
	}
	if got["detectedAt"] != testNow.Format(time.RFC3339) {
		t.Fatalf("detectedAt = %v", got["detectedAt"])
	}
	if len(f.tenants) != 1 || f.tenants[0] != "tenant-1" {
		t.Fatalf("service saw tenants %v", f.tenants)
	}

	// A second tenant on the same router must see its own row, not tenant-1's.
	f2 := &fakeService{}
	e2 := buildRouter(f2)
	rr2 := doReq(t, e2, "GET", "/api/v1/compliance/findings", "", authHeader("tenant-2", "admin"))
	list2 := listOf(t, rr2)
	if len(list2) != 1 || list2[0]["id"] != "f-9" {
		t.Fatalf("tenant-2 saw %v", list2)
	}
	if list2[0]["status"] != "completed" {
		t.Fatalf("closed mapped to %v", list2[0]["status"])
	}
	if f2.tenants[0] != "tenant-2" {
		t.Fatalf("service saw %v, want tenant-2", f2.tenants)
	}
}

func TestListFindingsEmptyTenantGetsAnEmptyList(t *testing.T) {
	f := &fakeService{}
	rr := doReq(t, buildRouter(f), "GET", "/api/v1/compliance/findings", "", authHeader("tenant-empty", "admin"))
	if rr.Code != http.StatusOK {
		t.Fatalf("got %d: %s", rr.Code, rr.Body.String())
	}
	if got := listOf(t, rr); len(got) != 0 {
		t.Fatalf("returned %d demo findings for a tenant with none", len(got))
	}
}

func TestListFindingsSurfacesRepositoryErrors(t *testing.T) {
	f := &fakeService{findingsErr: fmt.Errorf("relation audit_findings does not exist")}
	rr := doReq(t, buildRouter(f), "GET", "/api/v1/compliance/findings", "", authHeader("tenant-1", "admin"))
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("got %d, want 500", rr.Code)
	}
}

// --- Pure helpers ---

func TestFindingLevelMapping(t *testing.T) {
	cases := map[string]string{
		"critical": "critical", "high": "high", "medium": "medium", "low": "low",
		"CRITICAL": "critical", "High": "high",
		"weird": "info", "": "info",
	}
	for in, want := range cases {
		if got := findingLevel(in); got != want {
			t.Errorf("findingLevel(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestFindingStatusMapping(t *testing.T) {
	cases := map[string]string{
		"open": "pending", "in_progress": "running", "closed": "completed",
		"unknown": "pending", "": "pending",
	}
	for in, want := range cases {
		if got := findingStatus(in); got != want {
			t.Errorf("findingStatus(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestCountRules(t *testing.T) {
	cases := map[string]int{
		"":                        0,
		"   ":                     0,
		`[]`:                      0,
		`["a","b","c"]`:           3,
		`[{"id":"a"},{"id":"b"}]`: 2,
		`{"controls":["a","b"]}`:  2,
		`{"controls":[]}`:         0,
		`{"a":1,"b":2}`:           2,
		`not json`:                0,
	}
	for in, want := range cases {
		if got := countRules(in); got != want {
			t.Errorf("countRules(%q) = %d, want %d", in, got, want)
		}
	}
}

func TestListParamsResolvesLimitOffsetAndPage(t *testing.T) {
	cases := []struct {
		target     string
		wantLimit  int
		wantOffset int
	}{
		{"/api/v1/compliance/policies", defaultListLimit, 0},
		{"/api/v1/compliance/policies?limit=7&offset=3", 7, 3},
		{"/api/v1/compliance/policies?page=4", defaultListLimit, 3 * defaultListLimit},
		{"/api/v1/compliance/policies?limit=0&offset=2", defaultListLimit, 2},
		{"/api/v1/compliance/policies?limit=abc&offset=-4", defaultListLimit, 0},
	}
	for _, tc := range cases {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest("GET", tc.target, nil)
		limit, offset := listParams(c)
		if limit != tc.wantLimit || offset != tc.wantOffset {
			t.Errorf("%s -> (%d,%d), want (%d,%d)", tc.target, limit, offset, tc.wantLimit, tc.wantOffset)
		}
	}
}
