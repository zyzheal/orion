package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/script-version/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/script-version/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeScript_versionService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeScript_versionService struct{}

func (f *fakeScript_versionService) Create(ctx context.Context, tenantID string, req models.CreateScriptVersionRequest) (*models.ScriptVersion, error) {
	return &models.ScriptVersion{}, nil
}

func (f *fakeScript_versionService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeScript_versionService) Get(ctx context.Context, tenantID, id string) (*models.ScriptVersion, error) {
	return &models.ScriptVersion{}, nil
}

func (f *fakeScript_versionService) List(ctx context.Context, tenantID string) ([]models.ScriptVersion, error) {
	return []models.ScriptVersion{}, nil
}

func (f *fakeScript_versionService) Update(ctx context.Context, tenantID, id string, req models.UpdateScriptVersionRequest) (*models.ScriptVersion, error) {
	return &models.ScriptVersion{}, nil
}

var _ service.ServiceInterface = (*fakeScript_versionService)(nil)


func TestHandler_SCRIPT_VERSION_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SCRIPT_VERSI_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_SCRIPT_VERSI_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_SCRIPT_VERSI_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_SCRIPT_VERSI_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_SCRIPT_VERSI_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
