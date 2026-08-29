package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/script-library/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/script-library/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeScript_libraryService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeScript_libraryService struct{}

func (f *fakeScript_libraryService) Create(ctx context.Context, tenantID string, req models.CreateScriptLibraryRequest) (*models.ScriptLibrary, error) {
	return &models.ScriptLibrary{}, nil
}

func (f *fakeScript_libraryService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeScript_libraryService) Get(ctx context.Context, tenantID, id string) (*models.ScriptLibrary, error) {
	return &models.ScriptLibrary{}, nil
}

func (f *fakeScript_libraryService) List(ctx context.Context, tenantID string) ([]models.ScriptLibrary, error) {
	return []models.ScriptLibrary{}, nil
}

func (f *fakeScript_libraryService) Update(ctx context.Context, tenantID, id string, req models.UpdateScriptLibraryRequest) (*models.ScriptLibrary, error) {
	return &models.ScriptLibrary{}, nil
}

var _ service.ServiceInterface = (*fakeScript_libraryService)(nil)

func TestHandler_SCRIPT_LIBRARY_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SCRIPT_LIBRA_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_SCRIPT_LIBRA_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_SCRIPT_LIBRA_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_SCRIPT_LIBRA_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_SCRIPT_LIBRA_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
