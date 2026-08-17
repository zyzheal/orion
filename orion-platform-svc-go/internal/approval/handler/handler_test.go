package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/approval/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/approval/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeHandlerService{})
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
type fakeHandlerService struct{}

func (f *fakeHandlerService) AgentAnalyze(ctx context.Context, tenantID, approvalID string) (*models.ApprovalRequest, error) {
	return &models.ApprovalRequest{}, nil
}

func (f *fakeHandlerService) ApproveGate(ctx context.Context, tenantID, runID, stageID string, userID, userName, comment string) (*models.ApprovalGate, error) {
	return &models.ApprovalGate{}, nil
}

func (f *fakeHandlerService) ApproveRequest(ctx context.Context, tenantID, approvalID string, userID, userName string, comment string) (error) {
	return nil
}

func (f *fakeHandlerService) CancelApproval(ctx context.Context, tenantID, approvalID string, userID, userName string, comment string) (error) {
	return nil
}

func (f *fakeHandlerService) CreateApprovalRequest(ctx context.Context, tenantID, userID, userName string, req models.CreateApprovalRequest) (*models.ApprovalRequest, error) {
	return &models.ApprovalRequest{}, nil
}

func (f *fakeHandlerService) CreateTemplate(ctx context.Context, tenantID string, req models.CreateTemplateRequest) (*models.ApprovalTemplate, error) {
	return &models.ApprovalTemplate{}, nil
}

func (f *fakeHandlerService) DelegateApproval(ctx context.Context, tenantID, approvalID string, userID, userName string, req models.DelegateApprovalRequest) (error) {
	return nil
}

func (f *fakeHandlerService) DeleteApprovalRequest(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakeHandlerService) GetApprovalRequest(ctx context.Context, tenantID, id string) (*models.ApprovalRequest, error) {
	return &models.ApprovalRequest{}, nil
}

func (f *fakeHandlerService) GetHistory(ctx context.Context, tenantID, approvalID string) ([]models.ApprovalHistory, error) {
	return []models.ApprovalHistory{}, nil
}

func (f *fakeHandlerService) GetMyPendingApprovals(ctx context.Context, tenantID, userID string) ([]models.ApprovalRequest, error) {
	return []models.ApprovalRequest{}, nil
}

func (f *fakeHandlerService) GetPendingApprovals(ctx context.Context, tenantID string) ([]models.ApprovalRequest, error) {
	return []models.ApprovalRequest{}, nil
}

func (f *fakeHandlerService) GetStatistics(ctx context.Context, tenantID string) (models.ApprovalStatistics, error) {
	return models.ApprovalStatistics{}, nil
}

func (f *fakeHandlerService) GetStatus(ctx context.Context, tenantID, runID, stageID string) (*models.ApprovalGate, error) {
	return &models.ApprovalGate{}, nil
}

func (f *fakeHandlerService) GetTemplate(ctx context.Context, tenantID, id string) (*models.ApprovalTemplate, error) {
	return &models.ApprovalTemplate{}, nil
}

func (f *fakeHandlerService) GetTemplates(ctx context.Context, tenantID string, limit, offset int) ([]models.ApprovalTemplate, error) {
	return []models.ApprovalTemplate{}, nil
}

func (f *fakeHandlerService) GetTrend(ctx context.Context, tenantID string) ([]models.ApprovalTrendEntry, error) {
	return []models.ApprovalTrendEntry{}, nil
}

func (f *fakeHandlerService) ListApprovalRequests(ctx context.Context, tenantID, approvalType, status string, limit, offset int) ([]models.ApprovalRequest, error) {
	return []models.ApprovalRequest{}, nil
}

func (f *fakeHandlerService) ListByRun(ctx context.Context, tenantID, runID string) ([]models.ApprovalGate, error) {
	return []models.ApprovalGate{}, nil
}

func (f *fakeHandlerService) ReassignApproval(ctx context.Context, tenantID, approvalID string, userID, userName string, req models.ReassignApprovalRequest) (error) {
	return nil
}

func (f *fakeHandlerService) RejectGate(ctx context.Context, tenantID, runID, stageID string, userID, userName, comment string) (*models.ApprovalGate, error) {
	return &models.ApprovalGate{}, nil
}

func (f *fakeHandlerService) RejectRequest(ctx context.Context, tenantID, approvalID string, userID, userName string, comment string) (error) {
	return nil
}

func (f *fakeHandlerService) RequestEmergencyApproval(ctx context.Context, tenantID, userID, userName string, req models.EmergencyApprovalRequest) (*models.ApprovalRequest, error) {
	return &models.ApprovalRequest{}, nil
}

func (f *fakeHandlerService) ReviewApproval(ctx context.Context, tenantID, approvalID string, userID, userName string, req models.ReviewApprovalRequest) (error) {
	return nil
}

func (f *fakeHandlerService) UpdateTemplate(ctx context.Context, tenantID, id string, req models.UpdateTemplateRequest) (*models.ApprovalTemplate, error) {
	return &models.ApprovalTemplate{}, nil
}

func (f *fakeHandlerService) WithdrawApproval(ctx context.Context, tenantID, approvalID string, userID, userName string, comment string) (error) {
	return nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)
=======
type fakeapprovalService struct{}

func (f *fakeapprovalService) AgentAnalyze(ctx context.Context, tenantID, approvalID string) ((*models.ApprovalRequest, error)) {
	return &models.ApprovalRequest{}, nil
}

func (f *fakeapprovalService) ApproveGate(ctx context.Context, tenantID, runID, stageID string, userID, userName, comment string) ((*models.ApprovalGate, error)) {
	return &models.ApprovalGate{}, nil
}

func (f *fakeapprovalService) ApproveRequest(ctx context.Context, tenantID, approvalID string, userID, userName string, comment string) (error) {
	return nil
}

func (f *fakeapprovalService) CancelApproval(ctx context.Context, tenantID, approvalID string, userID, userName string, comment string) (error) {
	return nil
}

func (f *fakeapprovalService) CreateApprovalRequest(ctx context.Context, tenantID, userID, userName string, req models.CreateApprovalRequest) ((*models.ApprovalRequest, error)) {
	return &models.ApprovalRequest{}, nil
}

func (f *fakeapprovalService) CreateTemplate(ctx context.Context, tenantID string, req models.CreateTemplateRequest) ((*models.ApprovalTemplate, error)) {
	return &models.ApprovalTemplate{}, nil
}

func (f *fakeapprovalService) DelegateApproval(ctx context.Context, tenantID, approvalID string, userID, userName string, req models.DelegateApprovalRequest) (error) {
	return nil
}

func (f *fakeapprovalService) DeleteApprovalRequest(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakeapprovalService) GetApprovalRequest(ctx context.Context, tenantID, id string) ((*models.ApprovalRequest, error)) {
	return &models.ApprovalRequest{}, nil
}

func (f *fakeapprovalService) GetHistory(ctx context.Context, tenantID, approvalID string) (([]models.ApprovalHistory, error)) {
	return []models.ApprovalHistory{}, nil
}

func (f *fakeapprovalService) GetMyPendingApprovals(ctx context.Context, tenantID, userID string) (([]models.ApprovalRequest, error)) {
	return []models.ApprovalRequest{}, nil
}

func (f *fakeapprovalService) GetPendingApprovals(ctx context.Context, tenantID string) (([]models.ApprovalRequest, error)) {
	return []models.ApprovalRequest{}, nil
}

func (f *fakeapprovalService) GetStatistics(ctx context.Context, tenantID string) ((models.ApprovalStatistics, error)) {
	return models.ApprovalStatistics{}, nil
}

func (f *fakeapprovalService) GetStatus(ctx context.Context, tenantID, runID, stageID string) ((*models.ApprovalGate, error)) {
	return &models.ApprovalGate{}, nil
}

func (f *fakeapprovalService) GetTemplate(ctx context.Context, tenantID, id string) ((*models.ApprovalTemplate, error)) {
	return &models.ApprovalTemplate{}, nil
}

func (f *fakeapprovalService) GetTemplates(ctx context.Context, tenantID string, limit, offset int) (([]models.ApprovalTemplate, error)) {
	return []models.ApprovalTemplate{}, nil
}

func (f *fakeapprovalService) GetTrend(ctx context.Context, tenantID string) (([]models.ApprovalTrendEntry, error)) {
	return []models.ApprovalTrendEntry{}, nil
}

func (f *fakeapprovalService) ListApprovalRequests(ctx context.Context, tenantID, approvalType, status string, limit, offset int) (([]models.ApprovalRequest, error)) {
	return []models.ApprovalRequest{}, nil
}

func (f *fakeapprovalService) ListByRun(ctx context.Context, tenantID, runID string) (([]models.ApprovalGate, error)) {
	return []models.ApprovalGate{}, nil
}

func (f *fakeapprovalService) ReassignApproval(ctx context.Context, tenantID, approvalID string, userID, userName string, req models.ReassignApprovalRequest) (error) {
	return nil
}

func (f *fakeapprovalService) RejectGate(ctx context.Context, tenantID, runID, stageID string, userID, userName, comment string) ((*models.ApprovalGate, error)) {
	return &models.ApprovalGate{}, nil
}

func (f *fakeapprovalService) RejectRequest(ctx context.Context, tenantID, approvalID string, userID, userName string, comment string) (error) {
	return nil
}

func (f *fakeapprovalService) RequestEmergencyApproval(ctx context.Context, tenantID, userID, userName string, req models.EmergencyApprovalRequest) ((*models.ApprovalRequest, error)) {
	return &models.ApprovalRequest{}, nil
}

func (f *fakeapprovalService) ReviewApproval(ctx context.Context, tenantID, approvalID string, userID, userName string, req models.ReviewApprovalRequest) (error) {
	return nil
}

func (f *fakeapprovalService) UpdateTemplate(ctx context.Context, tenantID, id string, req models.UpdateTemplateRequest) ((*models.ApprovalTemplate, error)) {
	return &models.ApprovalTemplate{}, nil
}

func (f *fakeapprovalService) WithdrawApproval(ctx context.Context, tenantID, approvalID string, userID, userName string, comment string) (error) {
	return nil
}

var _ service.ServiceInterface = (*fakeapprovalService)(nil)
>>>>>>> Stashed changes


func TestAPPROVAL_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestAPPROVAL_Handler_SubmitApprovalRequest(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().SubmitApprovalRequest(c)
	if w.Code >= 500 {
		t.Fatalf("SubmitApprovalRequest: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_ListApprovalRequests(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListApprovalRequests(c)
	if w.Code >= 500 {
		t.Fatalf("ListApprovalRequests: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_GetApprovalRequest(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetApprovalRequest(c)
	if w.Code >= 500 {
		t.Fatalf("GetApprovalRequest: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_ReviewApproval(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ReviewApproval(c)
	if w.Code >= 500 {
		t.Fatalf("ReviewApproval: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_ApproveRequest(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ApproveRequest(c)
	if w.Code >= 500 {
		t.Fatalf("ApproveRequest: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_RejectRequest(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RejectRequest(c)
	if w.Code >= 500 {
		t.Fatalf("RejectRequest: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_WithdrawApproval(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().WithdrawApproval(c)
	if w.Code >= 500 {
		t.Fatalf("WithdrawApproval: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_CancelApproval(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CancelApproval(c)
	if w.Code >= 500 {
		t.Fatalf("CancelApproval: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_DelegateApproval(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DelegateApproval(c)
	if w.Code >= 500 {
		t.Fatalf("DelegateApproval: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_ReassignApproval(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ReassignApproval(c)
	if w.Code >= 500 {
		t.Fatalf("ReassignApproval: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_GetApprovalStatistics(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetApprovalStatistics(c)
	if w.Code >= 500 {
		t.Fatalf("GetApprovalStatistics: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_GetApprovalTrend(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetApprovalTrend(c)
	if w.Code >= 500 {
		t.Fatalf("GetApprovalTrend: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_GetApprovalHistory(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetApprovalHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetApprovalHistory: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_AgentAnalyze(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().AgentAnalyze(c)
	if w.Code >= 500 {
		t.Fatalf("AgentAnalyze: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_GetPendingApprovals(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetPendingApprovals(c)
	if w.Code >= 500 {
		t.Fatalf("GetPendingApprovals: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_GetMyPendingApprovals(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetMyPendingApprovals(c)
	if w.Code >= 500 {
		t.Fatalf("GetMyPendingApprovals: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_RequestEmergencyApproval(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RequestEmergencyApproval(c)
	if w.Code >= 500 {
		t.Fatalf("RequestEmergencyApproval: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_CreateTemplate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateTemplate(c)
	if w.Code >= 500 {
		t.Fatalf("CreateTemplate: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_GetTemplates(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetTemplates(c)
	if w.Code >= 500 {
		t.Fatalf("GetTemplates: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_ListByRun(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListByRun(c)
	if w.Code >= 500 {
		t.Fatalf("ListByRun: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_GetStatus(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetStatus(c)
	if w.Code >= 500 {
		t.Fatalf("GetStatus: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_ApproveGate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ApproveGate(c)
	if w.Code >= 500 {
		t.Fatalf("ApproveGate: got %d", w.Code)
	}
}

func TestAPPROVAL_Handler_RejectGate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RejectGate(c)
	if w.Code >= 500 {
		t.Fatalf("RejectGate: got %d", w.Code)
	}
}
