package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/unified-config/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/unified-config/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeUnified_configService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeUnified_configService struct{}

func (f *fakeUnified_configService) Create(ctx context.Context, tenantID string, req models.CreateUnifiedConfigRequest) (*models.UnifiedConfig, error) {
	return &models.UnifiedConfig{}, nil
}

func (f *fakeUnified_configService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeUnified_configService) Get(ctx context.Context, tenantID, id string) (*models.UnifiedConfig, error) {
	return &models.UnifiedConfig{}, nil
}

func (f *fakeUnified_configService) List(ctx context.Context, tenantID string) ([]models.UnifiedConfig, error) {
	return []models.UnifiedConfig{}, nil
}

func (f *fakeUnified_configService) Update(ctx context.Context, tenantID, id string, req models.UpdateUnifiedConfigRequest) (*models.UnifiedConfig, error) {
	return &models.UnifiedConfig{}, nil
}

var _ service.ServiceInterface = (*fakeUnified_configService)(nil)

func TestHandler_UNIFIED_CONFIG_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_UNIFIED_CONF_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_UNIFIED_CONF_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_UNIFIED_CONF_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_UNIFIED_CONF_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_UNIFIED_CONF_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
