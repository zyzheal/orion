package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/progressive/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/progressive/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeProgressiveService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeProgressiveService struct{}

func (f *fakeProgressiveService) CompleteStage(ctx context.Context, tenantID, deploymentID string, stageNumber int, healthOK bool, errorRate float64, metrics map[string]string) (*models.ProgressiveDeployment, error) {
	return &models.ProgressiveDeployment{}, nil
}

func (f *fakeProgressiveService) Create(ctx context.Context, tenantID string, req models.CreateProgressiveDeploymentRequest) (*models.ProgressiveDeployment, error) {
	return &models.ProgressiveDeployment{}, nil
}

func (f *fakeProgressiveService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeProgressiveService) Get(ctx context.Context, tenantID, id string) (*models.ProgressiveDeployment, error) {
	return &models.ProgressiveDeployment{}, nil
}

func (f *fakeProgressiveService) GetProgress(ctx context.Context, tenantID, deploymentID string) (*models.DeploymentProgress, error) {
	return &models.DeploymentProgress{}, nil
}

func (f *fakeProgressiveService) GetStages(ctx context.Context, tenantID, deploymentID string) ([]models.RolloutStage, error) {
	return []models.RolloutStage{}, nil
}

func (f *fakeProgressiveService) List(ctx context.Context, tenantID string) ([]models.ProgressiveDeployment, int, error) {
	return []models.ProgressiveDeployment{}, 0, nil
}

func (f *fakeProgressiveService) Pause(ctx context.Context, tenantID, deploymentID string) (*models.ProgressiveDeployment, error) {
	return &models.ProgressiveDeployment{}, nil
}

func (f *fakeProgressiveService) Resume(ctx context.Context, tenantID, deploymentID string) (*models.ProgressiveDeployment, error) {
	return &models.ProgressiveDeployment{}, nil
}

func (f *fakeProgressiveService) Rollback(ctx context.Context, tenantID, deploymentID string, reason string) (*models.ProgressiveDeployment, error) {
	return &models.ProgressiveDeployment{}, nil
}

func (f *fakeProgressiveService) StartRollout(ctx context.Context, tenantID, deploymentID string) (*models.ProgressiveDeployment, error) {
	return &models.ProgressiveDeployment{}, nil
}

func (f *fakeProgressiveService) Update(ctx context.Context, tenantID, id string, req models.UpdateProgressiveDeploymentRequest) (*models.ProgressiveDeployment, error) {
	return &models.ProgressiveDeployment{}, nil
}

var _ service.ServiceInterface = (*fakeProgressiveService)(nil)

func TestHandler_PROGRESSIVE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PROGRESSIVE_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_Start(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Start(c)
	if w.Code >= 500 {
		t.Fatalf("Start: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_CompleteStage(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CompleteStage(c)
	if w.Code >= 500 {
		t.Fatalf("CompleteStage: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_Pause(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Pause(c)
	if w.Code >= 500 {
		t.Fatalf("Pause: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_Resume(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Resume(c)
	if w.Code >= 500 {
		t.Fatalf("Resume: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_Rollback(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Rollback(c)
	if w.Code >= 500 {
		t.Fatalf("Rollback: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_ListStages(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListStages(c)
	if w.Code >= 500 {
		t.Fatalf("ListStages: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_GetProgress(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetProgress(c)
	if w.Code >= 500 {
		t.Fatalf("GetProgress: got %d", w.Code)
	}
}
