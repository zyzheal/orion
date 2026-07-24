package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	gov_models "orion/platform-svc-go/internal/governance/models"
	gov_service "orion/platform-svc-go/internal/governance/service"

	"github.com/gin-gonic/gin"
)

// mockSvc implements Service interface for governance handler tests.
type mockSvc struct {
	createPolicyFn        func(ctx context.Context, req *gov_models.CreatePolicyRequest, tenantID, userID string) (*gov_models.GovernancePolicy, error)
	getPolicyFn           func(ctx context.Context, id, tenantID string) (*gov_models.GovernancePolicy, error)
	listPoliciesFn        func(ctx context.Context, tenantID string, q *gov_models.PolicyListQuery, offset, limit int) ([]gov_models.GovernancePolicy, int, error)
	updatePolicyFn        func(ctx context.Context, id, tenantID string, req *gov_models.UpdatePolicyRequest, userID string) (*gov_models.GovernancePolicy, error)
	deletePolicyFn        func(ctx context.Context, id, tenantID string, userID string) error
	enablePolicyFn        func(ctx context.Context, id, tenantID string, userID string) (*gov_models.GovernancePolicy, error)
	disablePolicyFn       func(ctx context.Context, id, tenantID string, userID string) (*gov_models.GovernancePolicy, error)
	getAuditLogsFn        func(ctx context.Context, policyID string, offset, limit int) ([]gov_models.GovernanceAuditLog, int, error)
	checkComplianceFn     func(ctx context.Context, req *gov_models.ComplianceCheckRequest, tenantID string) (*gov_models.ComplianceCheckResponse, error)
	getComplianceReportFn func(ctx context.Context, tenantID string, period *gov_models.CompliancePeriod) (*gov_models.ComplianceReport, error)
	applyPolicyFn         func(ctx context.Context, id, tenantID string, req *gov_models.ApplyPolicyRequest, userID string) (*gov_models.PolicyApplyResult, error)
	getRulesFn            func(ctx context.Context, tenantID string, offset, limit int) ([]gov_models.PolicyRule, int, error)
}

func (m *mockSvc) CreatePolicy(ctx context.Context, req *gov_models.CreatePolicyRequest, tenantID, userID string) (*gov_models.GovernancePolicy, error) {
	if m.createPolicyFn != nil {
		return m.createPolicyFn(ctx, req, tenantID, userID)
	}
	return nil, nil
}
func (m *mockSvc) GetPolicy(ctx context.Context, id, tenantID string) (*gov_models.GovernancePolicy, error) {
	if m.getPolicyFn != nil {
		return m.getPolicyFn(ctx, id, tenantID)
	}
	return nil, nil
}
func (m *mockSvc) ListPolicies(ctx context.Context, tenantID string, q *gov_models.PolicyListQuery, offset, limit int) ([]gov_models.GovernancePolicy, int, error) {
	if m.listPoliciesFn != nil {
		return m.listPoliciesFn(ctx, tenantID, q, offset, limit)
	}
	return nil, 0, nil
}
func (m *mockSvc) UpdatePolicy(ctx context.Context, id, tenantID string, req *gov_models.UpdatePolicyRequest, userID string) (*gov_models.GovernancePolicy, error) {
	if m.updatePolicyFn != nil {
		return m.updatePolicyFn(ctx, id, tenantID, req, userID)
	}
	return nil, nil
}
func (m *mockSvc) DeletePolicy(ctx context.Context, id, tenantID string, userID string) error {
	if m.deletePolicyFn != nil {
		return m.deletePolicyFn(ctx, id, tenantID, userID)
	}
	return nil
}
func (m *mockSvc) EnablePolicy(ctx context.Context, id, tenantID string, userID string) (*gov_models.GovernancePolicy, error) {
	if m.enablePolicyFn != nil {
		return m.enablePolicyFn(ctx, id, tenantID, userID)
	}
	return nil, nil
}
func (m *mockSvc) DisablePolicy(ctx context.Context, id, tenantID string, userID string) (*gov_models.GovernancePolicy, error) {
	if m.disablePolicyFn != nil {
		return m.disablePolicyFn(ctx, id, tenantID, userID)
	}
	return nil, nil
}
func (m *mockSvc) GetAuditLogs(ctx context.Context, policyID string, offset, limit int) ([]gov_models.GovernanceAuditLog, int, error) {
	if m.getAuditLogsFn != nil {
		return m.getAuditLogsFn(ctx, policyID, offset, limit)
	}
	return nil, 0, nil
}
func (m *mockSvc) CheckCompliance(ctx context.Context, req *gov_models.ComplianceCheckRequest, tenantID string) (*gov_models.ComplianceCheckResponse, error) {
	if m.checkComplianceFn != nil {
		return m.checkComplianceFn(ctx, req, tenantID)
	}
	return nil, nil
}
func (m *mockSvc) GetComplianceReport(ctx context.Context, tenantID string, period *gov_models.CompliancePeriod) (*gov_models.ComplianceReport, error) {
	if m.getComplianceReportFn != nil {
		return m.getComplianceReportFn(ctx, tenantID, period)
	}
	return nil, nil
}
func (m *mockSvc) ApplyPolicy(ctx context.Context, id, tenantID string, req *gov_models.ApplyPolicyRequest, userID string) (*gov_models.PolicyApplyResult, error) {
	if m.applyPolicyFn != nil {
		return m.applyPolicyFn(ctx, id, tenantID, req, userID)
	}
	return nil, nil
}
func (m *mockSvc) GetRules(ctx context.Context, tenantID string, offset, limit int) ([]gov_models.PolicyRule, int, error) {
	if m.getRulesFn != nil {
		return m.getRulesFn(ctx, tenantID, offset, limit)
	}
	return nil, 0, nil
}

func newHandlerWithSvc(svc Service) *Handler {
	return NewHandler(svc)
}

func performRequest(h *Handler, handlerFn func(c *gin.Context), method string, body interface{}, pathParams map[string]string, queryParams map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Set("user_id", "user-1")

	var buf bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		buf = *bytes.NewBuffer(b)
	}
	c.Request = httptest.NewRequest(method, "/", &buf)
	c.Request.Header.Set("Content-Type", "application/json")

	if pathParams != nil {
		for k, v := range pathParams {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	if queryParams != nil {
		q := c.Request.URL.Query()
		for k, v := range queryParams {
			q.Set(k, v)
		}
		c.Request.URL.RawQuery = q.Encode()
	}

	handlerFn(c)
	return w
}

// make a sample policy returned by mock
func samplePolicy(id, name string) *gov_models.GovernancePolicy {
	return &gov_models.GovernancePolicy{
		ID:    id,
		Name:  name,
		Rules: "[{\"name\":\"r1\",\"condition\":{\"field\":\"f\",\"operator\":\"=\",\"value\":\"v\"},\"action\":{\"type\":\"block\",\"config\":{}},\"priority\":1,\"enabled\":true}]",
		Scope: "{\"include\":[\"*\"],\"exclude\":[]}",
		Metadata: "{}",
	}
}

// ==================== Create Policy ====================

func TestHandler_CreatePolicy_Success(t *testing.T) {
	p := samplePolicy("p-1", "my-policy")
	svc := &mockSvc{
		createPolicyFn: func(ctx context.Context, req *gov_models.CreatePolicyRequest, tenantID, userID string) (*gov_models.GovernancePolicy, error) {
			return p, nil
		},
	}
	h := newHandlerWithSvc(svc)
	req := gov_models.CreatePolicyRequest{
		Name:        "my-policy",
		Description: "desc",
		Type:        "quota",
		Severity:    "high",
		Rules:       []gov_models.PolicyRuleBody{{Name: "r1", Condition: gov_models.PolicyCondition{Field: "f", Operator: "="}, Action: gov_models.PolicyActionBody{Type: "block"}}},
		Scope:       &gov_models.PolicyScopeBody{Include: []string{"*"}},
		Enforcement: "strict",
	}
	w := performRequest(h, h.CreatePolicy, "POST", req, nil, nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", w.Code)
	}
}

func TestHandler_CreatePolicy_BadRequest(t *testing.T) {
	svc := &mockSvc{}
	h := newHandlerWithSvc(svc)
	// Missing required fields
	req := gov_models.CreatePolicyRequest{Name: ""}
	w := performRequest(h, h.CreatePolicy, "POST", req, nil, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// ==================== List Policies ====================

func TestHandler_ListPolicies_Success(t *testing.T) {
	svc := &mockSvc{
		listPoliciesFn: func(ctx context.Context, tenantID string, q *gov_models.PolicyListQuery, offset, limit int) ([]gov_models.GovernancePolicy, int, error) {
			return []gov_models.GovernancePolicy{{ID: "p-1", Name: "p1"}}, 1, nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.ListPolicies, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ListPolicies_Error(t *testing.T) {
	svc := &mockSvc{
		listPoliciesFn: func(ctx context.Context, tenantID string, q *gov_models.PolicyListQuery, offset, limit int) ([]gov_models.GovernancePolicy, int, error) {
			return nil, 0, errors.New("db error")
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.ListPolicies, "GET", nil, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// ==================== Get Policy ====================

func TestHandler_GetPolicy_Success(t *testing.T) {
	p := samplePolicy("p-1", "my-policy")
	svc := &mockSvc{
		getPolicyFn: func(ctx context.Context, id, tenantID string) (*gov_models.GovernancePolicy, error) {
			return p, nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetPolicy, "GET", nil, map[string]string{"id": "p-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetPolicy_NotFound(t *testing.T) {
	svc := &mockSvc{
		getPolicyFn: func(ctx context.Context, id, tenantID string) (*gov_models.GovernancePolicy, error) {
			return nil, gov_service.ErrNotFound
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetPolicy, "GET", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// ==================== Update Policy ====================

func TestHandler_UpdatePolicy_Success(t *testing.T) {
	p := samplePolicy("p-1", "updated")
	svc := &mockSvc{
		updatePolicyFn: func(ctx context.Context, id, tenantID string, req *gov_models.UpdatePolicyRequest, userID string) (*gov_models.GovernancePolicy, error) {
			return p, nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.UpdatePolicy, "PUT", gov_models.UpdatePolicyRequest{}, map[string]string{"id": "p-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_UpdatePolicy_NotFound(t *testing.T) {
	svc := &mockSvc{
		updatePolicyFn: func(ctx context.Context, id, tenantID string, req *gov_models.UpdatePolicyRequest, userID string) (*gov_models.GovernancePolicy, error) {
			return nil, gov_service.ErrNotFound
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.UpdatePolicy, "PUT", gov_models.UpdatePolicyRequest{}, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// ==================== Delete Policy ====================

func TestHandler_DeletePolicy_Success(t *testing.T) {
	svc := &mockSvc{
		deletePolicyFn: func(ctx context.Context, id, tenantID string, userID string) error {
			return nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.DeletePolicy, "DELETE", nil, map[string]string{"id": "p-1"}, nil)
	if w.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", w.Code)
	}
}

func TestHandler_DeletePolicy_NotFound(t *testing.T) {
	svc := &mockSvc{
		deletePolicyFn: func(ctx context.Context, id, tenantID string, userID string) error {
			return gov_service.ErrNotFound
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.DeletePolicy, "DELETE", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

// ==================== Enable / Disable ====================

func TestHandler_EnablePolicy_Success(t *testing.T) {
	p := samplePolicy("p-1", "active")
	svc := &mockSvc{
		enablePolicyFn: func(ctx context.Context, id, tenantID string, userID string) (*gov_models.GovernancePolicy, error) {
			return p, nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.EnablePolicy, "POST", nil, map[string]string{"id": "p-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_EnablePolicy_NotFound(t *testing.T) {
	svc := &mockSvc{
		enablePolicyFn: func(ctx context.Context, id, tenantID string, userID string) (*gov_models.GovernancePolicy, error) {
			return nil, gov_service.ErrNotFound
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.EnablePolicy, "POST", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestHandler_DisablePolicy_Success(t *testing.T) {
	p := samplePolicy("p-1", "paused")
	svc := &mockSvc{
		disablePolicyFn: func(ctx context.Context, id, tenantID string, userID string) (*gov_models.GovernancePolicy, error) {
			return p, nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.DisablePolicy, "POST", nil, map[string]string{"id": "p-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

// ==================== Audit Logs ====================

func TestHandler_GetAuditLogs_Success(t *testing.T) {
	svc := &mockSvc{
		getAuditLogsFn: func(ctx context.Context, policyID string, offset, limit int) ([]gov_models.GovernanceAuditLog, int, error) {
			return []gov_models.GovernanceAuditLog{{ID: "log-1", PolicyID: "p-1", Action: "create"}}, 1, nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetAuditLogs, "GET", nil, map[string]string{"id": "p-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_GetAuditLogs_Error(t *testing.T) {
	svc := &mockSvc{
		getAuditLogsFn: func(ctx context.Context, policyID string, offset, limit int) ([]gov_models.GovernanceAuditLog, int, error) {
			return nil, 0, errors.New("db error")
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetAuditLogs, "GET", nil, map[string]string{"id": "p-1"}, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// ==================== Compliance Check ====================

func TestHandler_CheckCompliance_Success(t *testing.T) {
	svc := &mockSvc{
		checkComplianceFn: func(ctx context.Context, req *gov_models.ComplianceCheckRequest, tenantID string) (*gov_models.ComplianceCheckResponse, error) {
			return &gov_models.ComplianceCheckResponse{ID: "check-1", Status: "compliant"}, nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.CheckCompliance, "POST", gov_models.ComplianceCheckRequest{ResourceID: "res-1", ResourceType: "service"}, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_CheckCompliance_BadRequest(t *testing.T) {
	svc := &mockSvc{}
	h := newHandlerWithSvc(svc)
	// Missing required fields
	w := performRequest(h, h.CheckCompliance, "POST", gov_models.ComplianceCheckRequest{}, nil, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_CheckCompliance_Error(t *testing.T) {
	svc := &mockSvc{
		checkComplianceFn: func(ctx context.Context, req *gov_models.ComplianceCheckRequest, tenantID string) (*gov_models.ComplianceCheckResponse, error) {
			return nil, errors.New("db error")
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.CheckCompliance, "POST", gov_models.ComplianceCheckRequest{ResourceID: "res-1", ResourceType: "service"}, nil, nil)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

// ==================== Compliance Report ====================

func TestHandler_GetComplianceReport_Success(t *testing.T) {
	svc := &mockSvc{
		getComplianceReportFn: func(ctx context.Context, tenantID string, period *gov_models.CompliancePeriod) (*gov_models.ComplianceReport, error) {
			return &gov_models.ComplianceReport{ID: "report-1", OverallScore: 90}, nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetComplianceReport, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

// ==================== Apply Policy ====================

func TestHandler_ApplyPolicy_Success(t *testing.T) {
	svc := &mockSvc{
		applyPolicyFn: func(ctx context.Context, id, tenantID string, req *gov_models.ApplyPolicyRequest, userID string) (*gov_models.PolicyApplyResult, error) {
			return &gov_models.PolicyApplyResult{PolicyID: id, Applied: true}, nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.ApplyPolicy, "POST", gov_models.ApplyPolicyRequest{ResourceID: "res-1", ResourceType: "service"}, map[string]string{"id": "p-1"}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestHandler_ApplyPolicy_NotActive(t *testing.T) {
	svc := &mockSvc{
		applyPolicyFn: func(ctx context.Context, id, tenantID string, req *gov_models.ApplyPolicyRequest, userID string) (*gov_models.PolicyApplyResult, error) {
			return nil, gov_service.ErrPolicyNotActive
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.ApplyPolicy, "POST", gov_models.ApplyPolicyRequest{ResourceID: "res-1", ResourceType: "service"}, map[string]string{"id": "p-1"}, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestHandler_ApplyPolicy_BadRequest(t *testing.T) {
	svc := &mockSvc{}
	h := newHandlerWithSvc(svc)
	// Missing required fields
	w := performRequest(h, h.ApplyPolicy, "POST", gov_models.ApplyPolicyRequest{}, map[string]string{"id": "p-1"}, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

// ==================== Rules ====================

func TestHandler_GetRules_Success(t *testing.T) {
	svc := &mockSvc{
		getRulesFn: func(ctx context.Context, tenantID string, offset, limit int) ([]gov_models.PolicyRule, int, error) {
			return []gov_models.PolicyRule{{ID: "rule-1", Name: "r1"}}, 1, nil
		},
	}
	h := newHandlerWithSvc(svc)
	w := performRequest(h, h.GetRules, "GET", nil, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}
