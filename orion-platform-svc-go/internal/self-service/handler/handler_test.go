package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/self-service/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/self-service/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeSelf_serviceService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeSelf_serviceService struct{}

func (f *fakeSelf_serviceService) Create(ctx context.Context, tenantID string, req models.CreateSelfServiceRequest) (*models.SelfService, error) {
	return &models.SelfService{}, nil
}

func (f *fakeSelf_serviceService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeSelf_serviceService) Get(ctx context.Context, tenantID, id string) (*models.SelfService, error) {
	return &models.SelfService{}, nil
}

func (f *fakeSelf_serviceService) List(ctx context.Context, tenantID string) ([]models.SelfService, error) {
	return []models.SelfService{}, nil
}

func (f *fakeSelf_serviceService) Update(ctx context.Context, tenantID, id string, req models.UpdateSelfServiceRequest) (*models.SelfService, error) {
	return &models.SelfService{}, nil
}

var _ service.ServiceInterface = (*fakeSelf_serviceService)(nil)

func TestHandler_SELF_SERVICE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SELF_SERVICE_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_SELF_SERVICE_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_SELF_SERVICE_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_SELF_SERVICE_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_SELF_SERVICE_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
