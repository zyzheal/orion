package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/dual-engine/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/dual-engine/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeDual_engineService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeDual_engineService struct{}

func (f *fakeDual_engineService) Create(ctx context.Context, tenantID string, req *models.CreateDualEngineRequest) (*models.DualEngine, error) {
	return &models.DualEngine{}, nil
}

func (f *fakeDual_engineService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeDual_engineService) Get(ctx context.Context, tenantID, id string) (*models.DualEngine, error) {
	return &models.DualEngine{}, nil
}

func (f *fakeDual_engineService) List(ctx context.Context, tenantID string) ([]models.DualEngine, error) {
	return []models.DualEngine{}, nil
}

func (f *fakeDual_engineService) Update(ctx context.Context, tenantID, id string, req *models.UpdateDualEngineRequest) (*models.DualEngine, error) {
	return &models.DualEngine{}, nil
}

var _ service.ServiceInterface = (*fakeDual_engineService)(nil)

func TestHandler_DUAL_ENGINE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_DUAL_ENGINE_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_DUAL_ENGINE_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_DUAL_ENGINE_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_DUAL_ENGINE_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_DUAL_ENGINE_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
