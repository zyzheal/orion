package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/plugin-hotreload/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/plugin-hotreload/models"
)

func newHandler() *Handler {
	return NewHandler(&fakePlugin_hotreloadService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakePlugin_hotreloadService struct{}

func (f *fakePlugin_hotreloadService) Create(ctx context.Context, tenantID string, req models.CreatePluginHotreloadRequest) (*models.PluginHotreload, error) {
	return &models.PluginHotreload{}, nil
}

func (f *fakePlugin_hotreloadService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakePlugin_hotreloadService) Get(ctx context.Context, tenantID, id string) (*models.PluginHotreload, error) {
	return &models.PluginHotreload{}, nil
}

func (f *fakePlugin_hotreloadService) List(ctx context.Context, tenantID string) ([]models.PluginHotreload, error) {
	return []models.PluginHotreload{}, nil
}

func (f *fakePlugin_hotreloadService) Update(ctx context.Context, tenantID, id string, req models.UpdatePluginHotreloadRequest) (*models.PluginHotreload, error) {
	return &models.PluginHotreload{}, nil
}

var _ service.ServiceInterface = (*fakePlugin_hotreloadService)(nil)


func TestHandler_PLUGIN_HOTRELO_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PLUGIN_HOTRE_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_HOTRE_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_HOTRE_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_HOTRE_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_HOTRE_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
