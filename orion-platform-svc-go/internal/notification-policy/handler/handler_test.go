package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/notification-policy/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/notification-policy/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeNotification_policyService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeNotification_policyService struct{}

func (f *fakeNotification_policyService) Count(ctx context.Context, tenantID string) (int, error) {
	return 0, nil
}

func (f *fakeNotification_policyService) Create(ctx context.Context, tenantID string, userID string, req *models.CreatePolicyRequest) (*models.Policy, error) {
	return &models.Policy{}, nil
}

func (f *fakeNotification_policyService) CreateWorkflow(ctx context.Context, tenantID string, userID string, req *models.CreateWorkflowRequest) (*models.PolicyWorkflow, error) {
	return &models.PolicyWorkflow{}, nil
}

func (f *fakeNotification_policyService) Delete(ctx context.Context, tenantID string, id string) (bool, error) {
	return false, nil
}

func (f *fakeNotification_policyService) DeleteWorkflow(ctx context.Context, tenantID string, policyID string, id string) (bool, error) {
	return false, nil
}

func (f *fakeNotification_policyService) Evaluate(ctx context.Context, tenantID string, userID string, req *models.EvaluateRequest) ([]models.EvaluateResult, error) {
	return []models.EvaluateResult{}, nil
}

func (f *fakeNotification_policyService) Get(ctx context.Context, tenantID string, id string) (*models.Policy, error) {
	return &models.Policy{}, nil
}

func (f *fakeNotification_policyService) GetWorkflow(ctx context.Context, tenantID string, policyID string, id string) (*models.PolicyWorkflow, error) {
	return &models.PolicyWorkflow{}, nil
}

func (f *fakeNotification_policyService) List(ctx context.Context, tenantID string, filter *models.ListFilter, page, pageSize int) ([]models.Policy, int, error) {
	return []models.Policy{}, 0, nil
}

func (f *fakeNotification_policyService) ListWorkflows(ctx context.Context, tenantID string, policyID string, page, pageSize int) ([]models.PolicyWorkflow, int, error) {
	return []models.PolicyWorkflow{}, 0, nil
}

func (f *fakeNotification_policyService) Update(ctx context.Context, tenantID string, id string, req *models.UpdatePolicyRequest) (*models.Policy, error) {
	return &models.Policy{}, nil
}

func (f *fakeNotification_policyService) UpdateWorkflow(ctx context.Context, tenantID string, policyID string, id string, req *models.UpdateWorkflowRequest) (*models.PolicyWorkflow, error) {
	return &models.PolicyWorkflow{}, nil
}

var _ service.ServiceInterface = (*fakeNotification_policyService)(nil)

func TestHandler_NOTIFICATION_P_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_NOTIFICATION_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_getUserID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getUserID(c)
	if w.Code >= 500 {
		t.Fatalf("getUserID: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_getPagination(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getPagination(c)
	if w.Code >= 500 {
		t.Fatalf("getPagination: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_ListPolicies(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListPolicies(c)
	if w.Code >= 500 {
		t.Fatalf("ListPolicies: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_GetPolicy(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetPolicy(c)
	if w.Code >= 500 {
		t.Fatalf("GetPolicy: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_CreatePolicy(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreatePolicy(c)
	if w.Code >= 500 {
		t.Fatalf("CreatePolicy: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_UpdatePolicy(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdatePolicy(c)
	if w.Code >= 500 {
		t.Fatalf("UpdatePolicy: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_DeletePolicy(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeletePolicy(c)
	if w.Code >= 500 {
		t.Fatalf("DeletePolicy: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_CountPolicies(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CountPolicies(c)
	if w.Code >= 500 {
		t.Fatalf("CountPolicies: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_EvaluatePolicies(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().EvaluatePolicies(c)
	if w.Code >= 500 {
		t.Fatalf("EvaluatePolicies: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_ListWorkflows(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListWorkflows(c)
	if w.Code >= 500 {
		t.Fatalf("ListWorkflows: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_GetWorkflow(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetWorkflow(c)
	if w.Code >= 500 {
		t.Fatalf("GetWorkflow: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_CreateWorkflow(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateWorkflow(c)
	if w.Code >= 500 {
		t.Fatalf("CreateWorkflow: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_UpdateWorkflow(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateWorkflow(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateWorkflow: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_DeleteWorkflow(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteWorkflow(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteWorkflow: got %d", w.Code)
	}
}
