package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/script/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/script/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeScriptService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeScriptService struct{}

func (f *fakeScriptService) Create(ctx context.Context, tenantID string, req models.CreateScriptRequest) (*models.Script, error) {
	return &models.Script{}, nil
}

func (f *fakeScriptService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeScriptService) Get(ctx context.Context, tenantID, id string) (*models.Script, error) {
	return &models.Script{}, nil
}

func (f *fakeScriptService) List(ctx context.Context, tenantID string) ([]models.Script, error) {
	return []models.Script{}, nil
}

func (f *fakeScriptService) Update(ctx context.Context, tenantID, id string, req models.UpdateScriptRequest) (*models.Script, error) {
	return &models.Script{}, nil
}

var _ service.ServiceInterface = (*fakeScriptService)(nil)

func TestHandler_SCRIPT_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SCRIPT_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_SCRIPT_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_SCRIPT_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_SCRIPT_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_SCRIPT_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
