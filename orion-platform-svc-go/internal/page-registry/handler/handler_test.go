package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/page-registry/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/page-registry/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakePage_registryService{})
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
type fakePage_registryService struct{}

func (f *fakePage_registryService) Create(ctx context.Context, tenantID string, req models.CreatePageRegistryRequest) (*models.PageRegistry, error) {
	return &models.PageRegistry{}, nil
}

func (f *fakePage_registryService) Delete(ctx context.Context, tenantID, path string) error {
	return nil
}

func (f *fakePage_registryService) GetAll(ctx context.Context, tenantID string) ([]models.PageRegistry, error) {
	return []models.PageRegistry{}, nil
}

func (f *fakePage_registryService) GetByPath(ctx context.Context, tenantID, path string) (*models.PageRegistry, error) {
	return &models.PageRegistry{}, nil
}

func (f *fakePage_registryService) GetEnabled(ctx context.Context, tenantID string) ([]models.PageRegistry, error) {
	return []models.PageRegistry{}, nil
}

func (f *fakePage_registryService) GetHistory(ctx context.Context, tenantID, path string) ([]models.PageRegistryHistory, error) {
	return []models.PageRegistryHistory{}, nil
}

func (f *fakePage_registryService) ToggleStatus(ctx context.Context, tenantID, path string) (*models.PageRegistry, error) {
	return &models.PageRegistry{}, nil
}

func (f *fakePage_registryService) Update(ctx context.Context, tenantID, path string, req models.UpdatePageRegistryRequest) (*models.PageRegistry, error) {
	return &models.PageRegistry{}, nil
}

var _ service.ServiceInterface = (*fakePage_registryService)(nil)
=======
type fakepage_registryService struct{}

func (f *fakepage_registryService) Create(ctx context.Context, tenantID string, req models.CreatePageRegistryRequest) ((*models.PageRegistry, error)) {
	return &models.PageRegistry{}, nil
}

func (f *fakepage_registryService) Delete(ctx context.Context, tenantID, path string) (error) {
	return nil
}

func (f *fakepage_registryService) GetAll(ctx context.Context, tenantID string) (([]models.PageRegistry, error)) {
	return []models.PageRegistry{}, nil
}

func (f *fakepage_registryService) GetByPath(ctx context.Context, tenantID, path string) ((*models.PageRegistry, error)) {
	return &models.PageRegistry{}, nil
}

func (f *fakepage_registryService) GetEnabled(ctx context.Context, tenantID string) (([]models.PageRegistry, error)) {
	return []models.PageRegistry{}, nil
}

func (f *fakepage_registryService) GetHistory(ctx context.Context, tenantID, path string) (([]models.PageRegistryHistory, error)) {
	return []models.PageRegistryHistory{}, nil
}

func (f *fakepage_registryService) ToggleStatus(ctx context.Context, tenantID, path string) ((*models.PageRegistry, error)) {
	return &models.PageRegistry{}, nil
}

func (f *fakepage_registryService) Update(ctx context.Context, tenantID, path string, req models.UpdatePageRegistryRequest) ((*models.PageRegistry, error)) {
	return &models.PageRegistry{}, nil
}

var _ service.ServiceInterface = (*fakepage_registryService)(nil)
>>>>>>> Stashed changes


func TestHandler_PAGE_REGISTRY_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PAGE_REGISTR_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_PAGE_REGISTR_ListEnabled(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListEnabled(c)
	if w.Code >= 500 {
		t.Fatalf("ListEnabled: got %d", w.Code)
	}
}
func TestHandler_PAGE_REGISTR_GetByPath(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetByPath(c)
	if w.Code >= 500 {
		t.Fatalf("GetByPath: got %d", w.Code)
	}
}
func TestHandler_PAGE_REGISTR_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_PAGE_REGISTR_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_PAGE_REGISTR_ToggleStatus(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ToggleStatus(c)
	if w.Code >= 500 {
		t.Fatalf("ToggleStatus: got %d", w.Code)
	}
}
func TestHandler_PAGE_REGISTR_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_PAGE_REGISTR_GetHistory(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetHistory: got %d", w.Code)
	}
}
