package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/module/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/module/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeModuleService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

<<<<<<< Updated upstream
type fakeModuleService struct{}

func (f *fakeModuleService) GetModuleByID(ctx context.Context, tenantID, id string) (*models.Module, error) {
	return &models.Module{}, nil
}

func (f *fakeModuleService) GetModuleStatus(ctx context.Context, tenantID string) (*models.ModuleStatusSnapshot, error) {
	return &models.ModuleStatusSnapshot{}, nil
}

func (f *fakeModuleService) GetStartupOrder(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeModuleService) ToggleModule(ctx context.Context, tenantID, id string, enabled bool) (*models.Module, error) {
	return &models.Module{}, nil
}

func (f *fakeModuleService) ValidateDependencies(ctx context.Context, tenantID string) ([]models.ValidationResult, error) {
	return []models.ValidationResult{}, nil
}

var _ service.ServiceInterface = (*fakeModuleService)(nil)
=======
type fakemoduleService struct{}

func (f *fakemoduleService) GetModuleByID(ctx context.Context, tenantID, id string) ((*models.Module, error)) {
	return &models.Module{}, nil
}

func (f *fakemoduleService) GetModuleStatus(ctx context.Context, tenantID string) ((*models.ModuleStatusSnapshot, error)) {
	return &models.ModuleStatusSnapshot{}, nil
}

func (f *fakemoduleService) GetStartupOrder(ctx context.Context, tenantID string) (([]string, error)) {
	return []string{}, nil
}

func (f *fakemoduleService) ToggleModule(ctx context.Context, tenantID, id string, enabled bool) ((*models.Module, error)) {
	return &models.Module{}, nil
}

func (f *fakemoduleService) ValidateDependencies(ctx context.Context, tenantID string) (([]models.ValidationResult, error)) {
	return []models.ValidationResult{}, nil
}

var _ service.ServiceInterface = (*fakemoduleService)(nil)
>>>>>>> Stashed changes


func TestHandler_MODULE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_MODULE_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_MODULE_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_MODULE_Toggle(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Toggle(c)
	if w.Code >= 500 {
		t.Fatalf("Toggle: got %d", w.Code)
	}
}
func TestHandler_MODULE_Validate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Validate(c)
	if w.Code >= 500 {
		t.Fatalf("Validate: got %d", w.Code)
	}
}
func TestHandler_MODULE_StartupOrder(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().StartupOrder(c)
	if w.Code >= 500 {
		t.Fatalf("StartupOrder: got %d", w.Code)
	}
}
