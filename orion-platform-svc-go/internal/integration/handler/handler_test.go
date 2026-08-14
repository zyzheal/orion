package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/integration/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/integration/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeIntegrationService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeIntegrationService struct{}

func (f *fakeIntegrationService) Create(ctx context.Context, tenantID string, req *models.CreateIntegrationRequest) (*models.Integration, error) {
	return &models.Integration{}, nil
}

func (f *fakeIntegrationService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeIntegrationService) Get(ctx context.Context, tenantID, id string) (*models.Integration, error) {
	return &models.Integration{}, nil
}

func (f *fakeIntegrationService) List(ctx context.Context, tenantID string) ([]models.Integration, error) {
	return []models.Integration{}, nil
}

func (f *fakeIntegrationService) Update(ctx context.Context, tenantID, id string, req *models.UpdateIntegrationRequest) (*models.Integration, error) {
	return &models.Integration{}, nil
}

var _ service.ServiceInterface = (*fakeIntegrationService)(nil)


func TestHandler_INTEGRATION_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_INTEGRATION_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_INTEGRATION_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_INTEGRATION_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_INTEGRATION_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_INTEGRATION_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
