package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/maintenance-window/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/maintenance-window/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeMaintenance_windowService{})
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
type fakeMaintenance_windowService struct{}

func (f *fakeMaintenance_windowService) Create(ctx context.Context, tenantID string, req *models.CreateMaintenanceWindowRequest) (*models.MaintenanceWindow, error) {
	return &models.MaintenanceWindow{}, nil
}

func (f *fakeMaintenance_windowService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeMaintenance_windowService) Get(ctx context.Context, tenantID, id string) (*models.MaintenanceWindow, error) {
	return &models.MaintenanceWindow{}, nil
}

func (f *fakeMaintenance_windowService) List(ctx context.Context, tenantID string) ([]models.MaintenanceWindow, error) {
	return []models.MaintenanceWindow{}, nil
}

func (f *fakeMaintenance_windowService) Update(ctx context.Context, tenantID, id string, req *models.UpdateMaintenanceWindowRequest) (*models.MaintenanceWindow, error) {
	return &models.MaintenanceWindow{}, nil
}

var _ service.ServiceInterface = (*fakeMaintenance_windowService)(nil)
=======
type fakemaintenance_windowService struct{}

func (f *fakemaintenance_windowService) Create(ctx context.Context, tenantID string, req *models.CreateMaintenanceWindowRequest) ((*models.MaintenanceWindow, error)) {
	return &models.MaintenanceWindow{}, nil
}

func (f *fakemaintenance_windowService) Delete(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakemaintenance_windowService) Get(ctx context.Context, tenantID, id string) ((*models.MaintenanceWindow, error)) {
	return &models.MaintenanceWindow{}, nil
}

func (f *fakemaintenance_windowService) List(ctx context.Context, tenantID string) (([]models.MaintenanceWindow, error)) {
	return []models.MaintenanceWindow{}, nil
}

func (f *fakemaintenance_windowService) Update(ctx context.Context, tenantID, id string, req *models.UpdateMaintenanceWindowRequest) ((*models.MaintenanceWindow, error)) {
	return &models.MaintenanceWindow{}, nil
}

var _ service.ServiceInterface = (*fakemaintenance_windowService)(nil)
>>>>>>> Stashed changes


func TestHandler_MAINTENANCE_WI_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_MAINTENANCE__List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_MAINTENANCE__Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_MAINTENANCE__Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_MAINTENANCE__Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_MAINTENANCE__Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
