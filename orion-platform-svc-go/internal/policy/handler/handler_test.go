package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/policy/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/policy/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakePolicyService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

<<<<<<< Updated upstream
type fakePolicyService struct{}

func (f *fakePolicyService) CreateOverride(ctx context.Context, tenantID string, req models.CreateOverrideRequest, overrideBy string) (*models.PolicyOverride, error) {
	return &models.PolicyOverride{}, nil
}

func (f *fakePolicyService) CreatePolicy(ctx context.Context, tenantID string, req models.CreatePolicyRequest) (*models.Policy, error) {
	return &models.Policy{}, nil
}

func (f *fakePolicyService) DeletePolicy(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakePolicyService) EvaluateGate(ctx context.Context, tenantID, gateID string, input map[string]any) (*models.EvaluatePolicyResponse, error) {
	return &models.EvaluatePolicyResponse{}, nil
}

func (f *fakePolicyService) EvaluatePolicy(ctx context.Context, tenantID string, req models.EvaluatePolicyRequest) (*models.EvaluatePolicyResponse, error) {
	return &models.EvaluatePolicyResponse{}, nil
}

func (f *fakePolicyService) GetBundle(ctx context.Context, tenantID, id string) (*models.PolicyBundle, error) {
	return &models.PolicyBundle{}, nil
}

func (f *fakePolicyService) GetEvaluationHistory(ctx context.Context, tenantID, policyID string, limit, offset int) ([]models.PolicyEvaluation, error) {
	return []models.PolicyEvaluation{}, nil
}

func (f *fakePolicyService) GetExemption(ctx context.Context, tenantID, id string) (*models.Exemption, error) {
	return &models.Exemption{}, nil
}

func (f *fakePolicyService) GetPolicy(ctx context.Context, tenantID, id string) (*models.Policy, error) {
	return &models.Policy{}, nil
}

func (f *fakePolicyService) GetViolation(ctx context.Context, tenantID, id string) (*models.Violation, error) {
	return &models.Violation{}, nil
}

func (f *fakePolicyService) ListBundles(ctx context.Context, tenantID string) ([]models.PolicyBundle, error) {
	return []models.PolicyBundle{}, nil
}

func (f *fakePolicyService) ListEvaluations(ctx context.Context, tenantID string, limit, offset int) ([]models.PolicyEvaluation, error) {
	return []models.PolicyEvaluation{}, nil
}

func (f *fakePolicyService) ListExemptions(ctx context.Context, tenantID string, req models.ListExemptionsRequest) (*models.ListExemptionsResponse, error) {
	return &models.ListExemptionsResponse{}, nil
}

func (f *fakePolicyService) ListOverrides(ctx context.Context, tenantID string, limit, offset int) ([]models.PolicyOverride, error) {
	return []models.PolicyOverride{}, nil
}

func (f *fakePolicyService) ListPolicies(ctx context.Context, tenantID string, limit, offset int) ([]models.Policy, error) {
	return []models.Policy{}, nil
}

func (f *fakePolicyService) ListViolations(ctx context.Context, tenantID string, limit, offset int) ([]models.Violation, error) {
	return []models.Violation{}, nil
}

func (f *fakePolicyService) ResolveViolation(ctx context.Context, tenantID, id string, req models.ResolveViolationRequest) error {
	return nil
}

func (f *fakePolicyService) ReviewExemption(ctx context.Context, tenantID, id string, req models.ReviewExemptionRequest) (*models.Exemption, error) {
	return &models.Exemption{}, nil
}

func (f *fakePolicyService) RevokeExemption(ctx context.Context, tenantID, id string) (*models.Exemption, error) {
	return &models.Exemption{}, nil
}

func (f *fakePolicyService) SubmitExemption(ctx context.Context, tenantID string, req models.CreateExemptionRequest) (*models.Exemption, error) {
	return &models.Exemption{}, nil
}

func (f *fakePolicyService) SyncBundles(ctx context.Context, tenantID string, sourceURL string) (*models.SyncBundlesResponse, error) {
	return &models.SyncBundlesResponse{}, nil
}

func (f *fakePolicyService) TestPolicy(ctx context.Context, rego string, testCases []map[string]any) ([]models.TestCaseResult, error) {
	return []models.TestCaseResult{}, nil
}

func (f *fakePolicyService) TogglePolicy(ctx context.Context, tenantID, id string, enabled bool) (*models.Policy, error) {
	return &models.Policy{}, nil
}

func (f *fakePolicyService) UpdatePolicy(ctx context.Context, tenantID, id string, req models.UpdatePolicyRequest) (*models.Policy, error) {
	return &models.Policy{}, nil
}

func (f *fakePolicyService) WaiveViolation(ctx context.Context, tenantID, id string, req models.WaiveViolationRequest) error {
	return nil
}

var _ service.ServiceInterface = (*fakePolicyService)(nil)
=======
type fakepolicyService struct{}

func (f *fakepolicyService) CreateOverride(ctx context.Context, tenantID string, req models.CreateOverrideRequest, overrideBy string) ((*models.PolicyOverride, error)) {
	return &models.PolicyOverride{}, nil
}

func (f *fakepolicyService) CreatePolicy(ctx context.Context, tenantID string, req models.CreatePolicyRequest) ((*models.Policy, error)) {
	return &models.Policy{}, nil
}

func (f *fakepolicyService) DeletePolicy(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakepolicyService) EvaluateGate(ctx context.Context, tenantID, gateID string, input map[string]any) ((*models.EvaluatePolicyResponse, error)) {
	return &models.EvaluatePolicyResponse{}, nil
}

func (f *fakepolicyService) EvaluatePolicy(ctx context.Context, tenantID string, req models.EvaluatePolicyRequest) ((*models.EvaluatePolicyResponse, error)) {
	return &models.EvaluatePolicyResponse{}, nil
}

func (f *fakepolicyService) GetBundle(ctx context.Context, tenantID, id string) ((*models.PolicyBundle, error)) {
	return &models.PolicyBundle{}, nil
}

func (f *fakepolicyService) GetEvaluationHistory(ctx context.Context, tenantID, policyID string, limit, offset int) (([]models.PolicyEvaluation, error)) {
	return []models.PolicyEvaluation{}, nil
}

func (f *fakepolicyService) GetExemption(ctx context.Context, tenantID, id string) ((*models.Exemption, error)) {
	return &models.Exemption{}, nil
}

func (f *fakepolicyService) GetPolicy(ctx context.Context, tenantID, id string) ((*models.Policy, error)) {
	return &models.Policy{}, nil
}

func (f *fakepolicyService) GetViolation(ctx context.Context, tenantID, id string) ((*models.Violation, error)) {
	return &models.Violation{}, nil
}

func (f *fakepolicyService) ListBundles(ctx context.Context, tenantID string) (([]models.PolicyBundle, error)) {
	return []models.PolicyBundle{}, nil
}

func (f *fakepolicyService) ListEvaluations(ctx context.Context, tenantID string, limit, offset int) (([]models.PolicyEvaluation, error)) {
	return []models.PolicyEvaluation{}, nil
}

func (f *fakepolicyService) ListExemptions(ctx context.Context, tenantID string, req models.ListExemptionsRequest) ((*models.ListExemptionsResponse, error)) {
	return &models.ListExemptionsResponse{}, nil
}

func (f *fakepolicyService) ListOverrides(ctx context.Context, tenantID string, limit, offset int) (([]models.PolicyOverride, error)) {
	return []models.PolicyOverride{}, nil
}

func (f *fakepolicyService) ListPolicies(ctx context.Context, tenantID string, limit, offset int) (([]models.Policy, error)) {
	return []models.Policy{}, nil
}

func (f *fakepolicyService) ListViolations(ctx context.Context, tenantID string, limit, offset int) (([]models.Violation, error)) {
	return []models.Violation{}, nil
}

func (f *fakepolicyService) ResolveViolation(ctx context.Context, tenantID, id string, req models.ResolveViolationRequest) (error) {
	return nil
}

func (f *fakepolicyService) ReviewExemption(ctx context.Context, tenantID, id string, req models.ReviewExemptionRequest) ((*models.Exemption, error)) {
	return &models.Exemption{}, nil
}

func (f *fakepolicyService) RevokeExemption(ctx context.Context, tenantID, id string) ((*models.Exemption, error)) {
	return &models.Exemption{}, nil
}

func (f *fakepolicyService) SubmitExemption(ctx context.Context, tenantID string, req models.CreateExemptionRequest) ((*models.Exemption, error)) {
	return &models.Exemption{}, nil
}

func (f *fakepolicyService) SyncBundles(ctx context.Context, tenantID string, sourceURL string) ((*models.SyncBundlesResponse, error)) {
	return &models.SyncBundlesResponse{}, nil
}

func (f *fakepolicyService) TestPolicy(ctx context.Context, rego string, testCases []map[string]any) (([]models.TestCaseResult, error)) {
	return []models.TestCaseResult{}, nil
}

func (f *fakepolicyService) TogglePolicy(ctx context.Context, tenantID, id string, enabled bool) ((*models.Policy, error)) {
	return &models.Policy{}, nil
}

func (f *fakepolicyService) UpdatePolicy(ctx context.Context, tenantID, id string, req models.UpdatePolicyRequest) ((*models.Policy, error)) {
	return &models.Policy{}, nil
}

func (f *fakepolicyService) WaiveViolation(ctx context.Context, tenantID, id string, req models.WaiveViolationRequest) (error) {
	return nil
}

var _ service.ServiceInterface = (*fakepolicyService)(nil)
>>>>>>> Stashed changes


func TestHandler_POLICY_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_POLICY_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_POLICY_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_POLICY_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_POLICY_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_POLICY_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_POLICY_Toggle(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Toggle(c)
	if w.Code >= 500 {
		t.Fatalf("Toggle: got %d", w.Code)
	}
}
func TestHandler_POLICY_Evaluate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Evaluate(c)
	if w.Code >= 500 {
		t.Fatalf("Evaluate: got %d", w.Code)
	}
}
func TestHandler_POLICY_ListEvaluations(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListEvaluations(c)
	if w.Code >= 500 {
		t.Fatalf("ListEvaluations: got %d", w.Code)
	}
}
func TestHandler_POLICY_EvaluatePolicyRoot(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().EvaluatePolicyRoot(c)
	if w.Code >= 500 {
		t.Fatalf("EvaluatePolicyRoot: got %d", w.Code)
	}
}
func TestHandler_POLICY_EvaluateRoot(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().EvaluateRoot(c)
	if w.Code >= 500 {
		t.Fatalf("EvaluateRoot: got %d", w.Code)
	}
}
func TestHandler_POLICY_ListRootEvaluations(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListRootEvaluations(c)
	if w.Code >= 500 {
		t.Fatalf("ListRootEvaluations: got %d", w.Code)
	}
}
func TestHandler_POLICY_ListEvaluationsRuns(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListEvaluationsRuns(c)
	if w.Code >= 500 {
		t.Fatalf("ListEvaluationsRuns: got %d", w.Code)
	}
}
func TestHandler_POLICY_ListViolations(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListViolations(c)
	if w.Code >= 500 {
		t.Fatalf("ListViolations: got %d", w.Code)
	}
}
func TestHandler_POLICY_WaiveViolation(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().WaiveViolation(c)
	if w.Code >= 500 {
		t.Fatalf("WaiveViolation: got %d", w.Code)
	}
}
func TestHandler_POLICY_ResolveViolation(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ResolveViolation(c)
	if w.Code >= 500 {
		t.Fatalf("ResolveViolation: got %d", w.Code)
	}
}
func TestHandler_POLICY_ListOverrides(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListOverrides(c)
	if w.Code >= 500 {
		t.Fatalf("ListOverrides: got %d", w.Code)
	}
}
func TestHandler_POLICY_CreateOverride(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateOverride(c)
	if w.Code >= 500 {
		t.Fatalf("CreateOverride: got %d", w.Code)
	}
}
func TestHandler_POLICY_ListBundles(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListBundles(c)
	if w.Code >= 500 {
		t.Fatalf("ListBundles: got %d", w.Code)
	}
}
func TestHandler_POLICY_GetBundle(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetBundle(c)
	if w.Code >= 500 {
		t.Fatalf("GetBundle: got %d", w.Code)
	}
}
func TestHandler_POLICY_SyncBundles(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SyncBundles(c)
	if w.Code >= 500 {
		t.Fatalf("SyncBundles: got %d", w.Code)
	}
}
func TestHandler_POLICY_TestPolicy(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().TestPolicy(c)
	if w.Code >= 500 {
		t.Fatalf("TestPolicy: got %d", w.Code)
	}
}
func TestHandler_POLICY_CreateExemption(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateExemption(c)
	if w.Code >= 500 {
		t.Fatalf("CreateExemption: got %d", w.Code)
	}
}
func TestHandler_POLICY_GetExemption(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetExemption(c)
	if w.Code >= 500 {
		t.Fatalf("GetExemption: got %d", w.Code)
	}
}
func TestHandler_POLICY_ListExemptions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListExemptions(c)
	if w.Code >= 500 {
		t.Fatalf("ListExemptions: got %d", w.Code)
	}
}
func TestHandler_POLICY_ApproveExemption(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ApproveExemption(c)
	if w.Code >= 500 {
		t.Fatalf("ApproveExemption: got %d", w.Code)
	}
}
func TestHandler_POLICY_RejectExemption(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RejectExemption(c)
	if w.Code >= 500 {
		t.Fatalf("RejectExemption: got %d", w.Code)
	}
}
func TestHandler_POLICY_RevokeExemption(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RevokeExemption(c)
	if w.Code >= 500 {
		t.Fatalf("RevokeExemption: got %d", w.Code)
	}
}
