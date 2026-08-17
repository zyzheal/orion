package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/smart-deploy/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/smart-deploy/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeSmart_deployService{})
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
type fakeSmart_deployService struct{}

func (f *fakeSmart_deployService) CancelDeployment(ctx context.Context, tenantID, id, cancelledBy string) (*models.Deployment, error) {
	return &models.Deployment{}, nil
}

func (f *fakeSmart_deployService) CreateAuditEntry(ctx context.Context, tenantID string, deploymentID, action, performedBy, details string) error {
	return nil
}

func (f *fakeSmart_deployService) Deploy(ctx context.Context, tenantID string, req models.CreateDeploymentRequest) (*models.Deployment, error) {
	return &models.Deployment{}, nil
}

func (f *fakeSmart_deployService) GetAuditTrail(ctx context.Context, tenantID, deploymentID string) ([]models.AuditEntry, error) {
	return []models.AuditEntry{}, nil
}

func (f *fakeSmart_deployService) GetDeployment(ctx context.Context, tenantID, id string) (*models.Deployment, error) {
	return &models.Deployment{}, nil
}

func (f *fakeSmart_deployService) GetLatestDeployment(ctx context.Context, tenantID, appName, environment string) (*models.Deployment, error) {
	return &models.Deployment{}, nil
}

func (f *fakeSmart_deployService) GetMetrics(ctx context.Context, tenantID string) (*models.DeploymentMetrics, error) {
	return &models.DeploymentMetrics{}, nil
}

func (f *fakeSmart_deployService) GetRollbackHistory(ctx context.Context, tenantID, deploymentID string) ([]models.Rollback, error) {
	return []models.Rollback{}, nil
}

func (f *fakeSmart_deployService) ListDeployments(ctx context.Context, tenantID string, opt models.ListDeploymentsOptions) ([]models.Deployment, int, error) {
	return []models.Deployment{}, 0, nil
}

func (f *fakeSmart_deployService) Rollback(ctx context.Context, tenantID, deploymentID string, req models.CreateRollbackRequest) (*models.Rollback, error) {
	return &models.Rollback{}, nil
}

var _ service.ServiceInterface = (*fakeSmart_deployService)(nil)
=======
type fakesmart_deployService struct{}

func (f *fakesmart_deployService) CancelDeployment(ctx context.Context, tenantID, id, cancelledBy string) ((*models.Deployment, error)) {
	return &models.Deployment{}, nil
}

func (f *fakesmart_deployService) CreateAuditEntry(ctx context.Context, tenantID string, deploymentID, action, performedBy, details string) (error) {
	return nil
}

func (f *fakesmart_deployService) Deploy(ctx context.Context, tenantID string, req models.CreateDeploymentRequest) ((*models.Deployment, error)) {
	return &models.Deployment{}, nil
}

func (f *fakesmart_deployService) GetAuditTrail(ctx context.Context, tenantID, deploymentID string) (([]models.AuditEntry, error)) {
	return []models.AuditEntry{}, nil
}

func (f *fakesmart_deployService) GetDeployment(ctx context.Context, tenantID, id string) ((*models.Deployment, error)) {
	return &models.Deployment{}, nil
}

func (f *fakesmart_deployService) GetLatestDeployment(ctx context.Context, tenantID, appName, environment string) ((*models.Deployment, error)) {
	return &models.Deployment{}, nil
}

func (f *fakesmart_deployService) GetMetrics(ctx context.Context, tenantID string) ((*models.DeploymentMetrics, error)) {
	return &models.DeploymentMetrics{}, nil
}

func (f *fakesmart_deployService) GetRollbackHistory(ctx context.Context, tenantID, deploymentID string) (([]models.Rollback, error)) {
	return []models.Rollback{}, nil
}

func (f *fakesmart_deployService) ListDeployments(ctx context.Context, tenantID string, opt models.ListDeploymentsOptions) (([]models.Deployment, int, error)) {
	return []models.Deployment{}, 0, nil
}

func (f *fakesmart_deployService) Rollback(ctx context.Context, tenantID, deploymentID string, req models.CreateRollbackRequest) ((*models.Rollback, error)) {
	return &models.Rollback{}, nil
}

var _ service.ServiceInterface = (*fakesmart_deployService)(nil)
>>>>>>> Stashed changes


func TestHandler_SMART_DEPLOY_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SMART_DEPLOY_CreateDeployment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateDeployment(c)
	if w.Code >= 500 {
		t.Fatalf("CreateDeployment: got %d", w.Code)
	}
}
func TestHandler_SMART_DEPLOY_GetDeployment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDeployment(c)
	if w.Code >= 500 {
		t.Fatalf("GetDeployment: got %d", w.Code)
	}
}
func TestHandler_SMART_DEPLOY_ListDeployments(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListDeployments(c)
	if w.Code >= 500 {
		t.Fatalf("ListDeployments: got %d", w.Code)
	}
}
func TestHandler_SMART_DEPLOY_GetLatestDeployment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetLatestDeployment(c)
	if w.Code >= 500 {
		t.Fatalf("GetLatestDeployment: got %d", w.Code)
	}
}
func TestHandler_SMART_DEPLOY_CancelDeployment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CancelDeployment(c)
	if w.Code >= 500 {
		t.Fatalf("CancelDeployment: got %d", w.Code)
	}
}
func TestHandler_SMART_DEPLOY_DeleteDeployment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteDeployment(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteDeployment: got %d", w.Code)
	}
}
func TestHandler_SMART_DEPLOY_Rollback(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Rollback(c)
	if w.Code >= 500 {
		t.Fatalf("Rollback: got %d", w.Code)
	}
}
func TestHandler_SMART_DEPLOY_GetRollbackHistory(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetRollbackHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetRollbackHistory: got %d", w.Code)
	}
}
func TestHandler_SMART_DEPLOY_GetMetrics(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("GetMetrics: got %d", w.Code)
	}
}
func TestHandler_SMART_DEPLOY_GetAuditTrail(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetAuditTrail(c)
	if w.Code >= 500 {
		t.Fatalf("GetAuditTrail: got %d", w.Code)
	}
}
