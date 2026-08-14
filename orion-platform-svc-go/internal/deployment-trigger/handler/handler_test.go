package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/deployment-trigger/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/deployment-trigger/models"
	"time"
)

func newHandler() *Handler {
	return NewHandler(&fakeDeployment_triggerService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeDeployment_triggerService struct{}

func (f *fakeDeployment_triggerService) Create(ctx context.Context, tenantID string, req *models.CreateTriggerRequest) (*models.DeploymentTrigger, error) {
	return &models.DeploymentTrigger{}, nil
}

func (f *fakeDeployment_triggerService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeDeployment_triggerService) EvaluateCron(expression string) (*time.Time, error) {
	return &time.Time{}, nil
}

func (f *fakeDeployment_triggerService) Execute(ctx context.Context, tenantID, id string) (*models.TriggerExecution, error) {
	return &models.TriggerExecution{}, nil
}

func (f *fakeDeployment_triggerService) Get(ctx context.Context, tenantID, id string) (*models.DeploymentTrigger, error) {
	return &models.DeploymentTrigger{}, nil
}

func (f *fakeDeployment_triggerService) GetExecutions(ctx context.Context, tenantID, id string, limit int) ([]models.TriggerExecution, error) {
	return []models.TriggerExecution{}, nil
}

func (f *fakeDeployment_triggerService) List(ctx context.Context, tenantID string) ([]models.DeploymentTrigger, error) {
	return []models.DeploymentTrigger{}, nil
}

func (f *fakeDeployment_triggerService) Update(ctx context.Context, tenantID, id string, req *models.UpdateTriggerRequest) (*models.DeploymentTrigger, error) {
	return &models.DeploymentTrigger{}, nil
}

var _ service.ServiceInterface = (*fakeDeployment_triggerService)(nil)


func TestHandler_DEPLOYMENT_TRI_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_DEPLOYMENT_T_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_DEPLOYMENT_T_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_DEPLOYMENT_T_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_DEPLOYMENT_T_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_DEPLOYMENT_T_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_DEPLOYMENT_T_GetExecutions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetExecutions(c)
	if w.Code >= 500 {
		t.Fatalf("GetExecutions: got %d", w.Code)
	}
}
func TestHandler_DEPLOYMENT_T_Execute(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Execute(c)
	if w.Code >= 500 {
		t.Fatalf("Execute: got %d", w.Code)
	}
}
