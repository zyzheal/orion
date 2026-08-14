package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/deploy-enhanced/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/deploy-enhanced/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeDeploy_enhancedService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeDeploy_enhancedService struct{}

func (f *fakeDeploy_enhancedService) AdvanceStage(ctx context.Context, id string, stageID string, validationResult *string, tenantID string) (*models.ProgressiveDeploy, error) {
	return &models.ProgressiveDeploy{}, nil
}

func (f *fakeDeploy_enhancedService) ApproveEmergencyDeploy(ctx context.Context, id string, approvedBy string, tenantID string) (*models.EmergencyDeploy, error) {
	return &models.EmergencyDeploy{}, nil
}

func (f *fakeDeploy_enhancedService) CheckWindow(ctx context.Context, id string, tenantID string) (*models.WindowCheckResult, error) {
	return &models.WindowCheckResult{}, nil
}

func (f *fakeDeploy_enhancedService) CompleteEmergencyDeploy(ctx context.Context, id string, postMortem *string, tenantID string) (*models.EmergencyDeploy, error) {
	return &models.EmergencyDeploy{}, nil
}

func (f *fakeDeploy_enhancedService) CreateProgressiveDeploy(ctx context.Context, deploymentID string, req *models.CreateProgressiveDeployRequest, tenantID string) (*models.ProgressiveDeploy, error) {
	return &models.ProgressiveDeploy{}, nil
}

func (f *fakeDeploy_enhancedService) CreateWindow(ctx context.Context, req *models.CreateDeployWindowRequest, tenantID string) (*models.DeployWindow, error) {
	return &models.DeployWindow{}, nil
}

func (f *fakeDeploy_enhancedService) DeleteWindow(ctx context.Context, id string, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeDeploy_enhancedService) GetEmergencyDeploy(ctx context.Context, id string, tenantID string) (*models.EmergencyDeploy, error) {
	return &models.EmergencyDeploy{}, nil
}

func (f *fakeDeploy_enhancedService) GetProgress(ctx context.Context, id string, tenantID string) (*models.ProgressiveDeploy, error) {
	return &models.ProgressiveDeploy{}, nil
}

func (f *fakeDeploy_enhancedService) GetWindow(ctx context.Context, id string, tenantID string) (*models.DeployWindow, error) {
	return &models.DeployWindow{}, nil
}

func (f *fakeDeploy_enhancedService) ListEmergencies(ctx context.Context, tenantID string, status *string) ([]models.EmergencyDeploy, int, error) {
	return []models.EmergencyDeploy{}, 0, nil
}

func (f *fakeDeploy_enhancedService) ListWindows(ctx context.Context, tenantID string, environmentID *string, status *string) ([]models.DeployWindow, int, error) {
	return []models.DeployWindow{}, 0, nil
}

func (f *fakeDeploy_enhancedService) RejectEmergencyDeploy(ctx context.Context, id string, tenantID string) (*models.EmergencyDeploy, error) {
	return &models.EmergencyDeploy{}, nil
}

func (f *fakeDeploy_enhancedService) RequestEmergencyDeploy(ctx context.Context, req *models.CreateEmergencyDeployRequest, tenantID string) (*models.EmergencyDeploy, error) {
	return &models.EmergencyDeploy{}, nil
}

func (f *fakeDeploy_enhancedService) RollbackStage(ctx context.Context, id string, stageID string, reason string, tenantID string) (*models.ProgressiveDeploy, error) {
	return &models.ProgressiveDeploy{}, nil
}

func (f *fakeDeploy_enhancedService) UpdateWindow(ctx context.Context, id string, req *models.UpdateDeployWindowRequest, tenantID string) (*models.DeployWindow, error) {
	return &models.DeployWindow{}, nil
}

var _ service.ServiceInterface = (*fakeDeploy_enhancedService)(nil)


func TestHandler_DEPLOY_ENHANCE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_DEPLOY_ENHAN_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_ListWindows(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListWindows(c)
	if w.Code >= 500 {
		t.Fatalf("ListWindows: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_GetWindow(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetWindow(c)
	if w.Code >= 500 {
		t.Fatalf("GetWindow: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_CreateWindow(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateWindow(c)
	if w.Code >= 500 {
		t.Fatalf("CreateWindow: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_UpdateWindow(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateWindow(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateWindow: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_DeleteWindow(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteWindow(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteWindow: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_CheckWindow(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CheckWindow(c)
	if w.Code >= 500 {
		t.Fatalf("CheckWindow: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_CreateProgressiveDeploy(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateProgressiveDeploy(c)
	if w.Code >= 500 {
		t.Fatalf("CreateProgressiveDeploy: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_GetProgress(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetProgress(c)
	if w.Code >= 500 {
		t.Fatalf("GetProgress: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_AdvanceStage(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AdvanceStage(c)
	if w.Code >= 500 {
		t.Fatalf("AdvanceStage: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_RollbackStage(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RollbackStage(c)
	if w.Code >= 500 {
		t.Fatalf("RollbackStage: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_RequestEmergencyDeploy(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RequestEmergencyDeploy(c)
	if w.Code >= 500 {
		t.Fatalf("RequestEmergencyDeploy: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_ListEmergencies(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListEmergencies(c)
	if w.Code >= 500 {
		t.Fatalf("ListEmergencies: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_ApproveEmergencyDeploy(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ApproveEmergencyDeploy(c)
	if w.Code >= 500 {
		t.Fatalf("ApproveEmergencyDeploy: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_CompleteEmergencyDeploy(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CompleteEmergencyDeploy(c)
	if w.Code >= 500 {
		t.Fatalf("CompleteEmergencyDeploy: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_RejectEmergencyDeploy(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RejectEmergencyDeploy(c)
	if w.Code >= 500 {
		t.Fatalf("RejectEmergencyDeploy: got %d", w.Code)
	}
}
