package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/change-request/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/change-request/models"
	"time"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeChange_requestService{})
}

func makeCtx(method string, path string, body interface{}, params map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	buf := new(bytes.Buffer)
	if body != nil {
		json.NewEncoder(buf).Encode(body)
	}
	c.Request = httptest.NewRequest(method, path, buf)
	if params != nil {
		c.Params = gin.Params{}
		for k, v := range params {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	return c, w
}

<<<<<<< Updated upstream
type fakeChange_requestService struct{}

func (f *fakeChange_requestService) ApproveRequest(ctx context.Context, requestID string, approvalID string, tenantID string, approverID string, comments *string) (*models.ChangeApproval, error) {
	return &models.ChangeApproval{}, nil
}

func (f *fakeChange_requestService) CreateRequest(ctx context.Context, req *models.CreateChangeRequestRequest, tenantID string) (*models.ChangeRequest, error) {
	return &models.ChangeRequest{}, nil
}

func (f *fakeChange_requestService) DeleteRequest(ctx context.Context, id string, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeChange_requestService) GetApprovalChain(ctx context.Context, requestID string, tenantID string) ([]models.ChangeApproval, error) {
	return []models.ChangeApproval{}, nil
}

func (f *fakeChange_requestService) GetExecutionProgress(ctx context.Context, requestID string, tenantID string) (*models.ExecutionProgress, error) {
	return &models.ExecutionProgress{}, nil
}

func (f *fakeChange_requestService) GetRequest(ctx context.Context, id string, tenantID string) (*models.ChangeRequest, error) {
	return &models.ChangeRequest{}, nil
}

func (f *fakeChange_requestService) ListRequests(ctx context.Context, tenantID string, filters *models.ListChangeRequestRequest) ([]models.ChangeRequest, int, error) {
	return []models.ChangeRequest{}, 0, nil
}

func (f *fakeChange_requestService) RejectRequest(ctx context.Context, requestID string, approvalID string, tenantID string, approverID string, comments *string) (*models.ChangeApproval, error) {
	return &models.ChangeApproval{}, nil
}

func (f *fakeChange_requestService) StartExecution(ctx context.Context, requestID string, tenantID string, steps []models.CreateExecutionStepRequest) ([]models.ExecutionStep, error) {
	return []models.ExecutionStep{}, nil
}

func (f *fakeChange_requestService) SubmitForApproval(ctx context.Context, id string, tenantID string) (*models.ChangeRequest, error) {
	return &models.ChangeRequest{}, nil
}

func (f *fakeChange_requestService) UpdateExecutionStep(ctx context.Context, stepID string, tenantID string, status string, result map[string]any, startedAt *time.Time, completedAt *time.Time) (*models.ExecutionStep, error) {
	return &models.ExecutionStep{}, nil
}

func (f *fakeChange_requestService) UpdateRequest(ctx context.Context, id string, tenantID string, req *models.UpdateChangeRequestRequest) (*models.ChangeRequest, error) {
	return &models.ChangeRequest{}, nil
}

var _ service.ServiceInterface = (*fakeChange_requestService)(nil)
=======
type fakechange_requestService struct{}

func (f *fakechange_requestService) ApproveRequest(ctx context.Context, requestID string, approvalID string, tenantID string, approverID string, comments *string) ((*models.ChangeApproval, error)) {
	return &models.ChangeApproval{}, nil
}

func (f *fakechange_requestService) CreateRequest(ctx context.Context, req *models.CreateChangeRequestRequest, tenantID string) ((*models.ChangeRequest, error)) {
	return &models.ChangeRequest{}, nil
}

func (f *fakechange_requestService) DeleteRequest(ctx context.Context, id string, tenantID string) ((bool, error)) {
	return false, nil
}

func (f *fakechange_requestService) GetApprovalChain(ctx context.Context, requestID string, tenantID string) (([]models.ChangeApproval, error)) {
	return []models.ChangeApproval{}, nil
}

func (f *fakechange_requestService) GetExecutionProgress(ctx context.Context, requestID string, tenantID string) ((*models.ExecutionProgress, error)) {
	return &models.ExecutionProgress{}, nil
}

func (f *fakechange_requestService) GetRequest(ctx context.Context, id string, tenantID string) ((*models.ChangeRequest, error)) {
	return &models.ChangeRequest{}, nil
}

func (f *fakechange_requestService) ListRequests(ctx context.Context, tenantID string, filters *models.ListChangeRequestRequest) (([]models.ChangeRequest, int, error)) {
	return []models.ChangeRequest{}, 0, nil
}

func (f *fakechange_requestService) RejectRequest(ctx context.Context, requestID string, approvalID string, tenantID string, approverID string, comments *string) ((*models.ChangeApproval, error)) {
	return &models.ChangeApproval{}, nil
}

func (f *fakechange_requestService) StartExecution(ctx context.Context, requestID string, tenantID string, steps []models.CreateExecutionStepRequest) (([]models.ExecutionStep, error)) {
	return []models.ExecutionStep{}, nil
}

func (f *fakechange_requestService) SubmitForApproval(ctx context.Context, id string, tenantID string) ((*models.ChangeRequest, error)) {
	return &models.ChangeRequest{}, nil
}

func (f *fakechange_requestService) UpdateExecutionStep(ctx context.Context, stepID string, tenantID string, status string, result map[string]any, startedAt *time.Time, completedAt *time.Time) ((*models.ExecutionStep, error)) {
	return &models.ExecutionStep{}, nil
}

func (f *fakechange_requestService) UpdateRequest(ctx context.Context, id string, tenantID string, req *models.UpdateChangeRequestRequest) ((*models.ChangeRequest, error)) {
	return &models.ChangeRequest{}, nil
}

var _ service.ServiceInterface = (*fakechange_requestService)(nil)
>>>>>>> Stashed changes


func TestCHANGE_REQUEST_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCHANGE_REQUEST_Handler_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}

func TestCHANGE_REQUEST_Handler_ListRequests(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListRequests(c)
	if w.Code >= 500 {
		t.Fatalf("ListRequests: got %d", w.Code)
	}
}

func TestCHANGE_REQUEST_Handler_GetRequest(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetRequest(c)
	if w.Code >= 500 {
		t.Fatalf("GetRequest: got %d", w.Code)
	}
}

func TestCHANGE_REQUEST_Handler_CreateRequest(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateRequest(c)
	if w.Code >= 500 {
		t.Fatalf("CreateRequest: got %d", w.Code)
	}
}

func TestCHANGE_REQUEST_Handler_UpdateRequest(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateRequest(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateRequest: got %d", w.Code)
	}
}

func TestCHANGE_REQUEST_Handler_DeleteRequest(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteRequest(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteRequest: got %d", w.Code)
	}
}

func TestCHANGE_REQUEST_Handler_SubmitForApproval(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().SubmitForApproval(c)
	if w.Code >= 500 {
		t.Fatalf("SubmitForApproval: got %d", w.Code)
	}
}

func TestCHANGE_REQUEST_Handler_GetApprovalChain(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetApprovalChain(c)
	if w.Code >= 500 {
		t.Fatalf("GetApprovalChain: got %d", w.Code)
	}
}

func TestCHANGE_REQUEST_Handler_ApproveRequest(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ApproveRequest(c)
	if w.Code >= 500 {
		t.Fatalf("ApproveRequest: got %d", w.Code)
	}
}

func TestCHANGE_REQUEST_Handler_RejectRequest(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RejectRequest(c)
	if w.Code >= 500 {
		t.Fatalf("RejectRequest: got %d", w.Code)
	}
}

func TestCHANGE_REQUEST_Handler_StartExecution(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().StartExecution(c)
	if w.Code >= 500 {
		t.Fatalf("StartExecution: got %d", w.Code)
	}
}

func TestCHANGE_REQUEST_Handler_GetExecutionProgress(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetExecutionProgress(c)
	if w.Code >= 500 {
		t.Fatalf("GetExecutionProgress: got %d", w.Code)
	}
}

func TestCHANGE_REQUEST_Handler_UpdateExecutionStep(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateExecutionStep(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateExecutionStep: got %d", w.Code)
	}
}
