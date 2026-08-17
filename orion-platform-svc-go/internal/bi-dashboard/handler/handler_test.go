package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/bi-dashboard/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/bi-dashboard/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeBi_dashboardService{})
}

func makeCtx(method string, path string, body interface{}, params map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	buf := new(bytes.Buffer)
	if body != nil {
		json.NewEncoder(buf).Encode(body)
	}
	c.Request = httptest.NewRequest(method, path, buf)
	if params != nil {
		c.Params = gin.Params{}
		for k, v := range params {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	return c, w
}

<<<<<<< Updated upstream
type fakeBi_dashboardService struct{}

func (f *fakeBi_dashboardService) Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.BiDashboard, error) {
	return &models.BiDashboard{}, nil
}

func (f *fakeBi_dashboardService) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeBi_dashboardService) Get(ctx context.Context, id, tenantID string) (*models.BiDashboard, error) {
	return &models.BiDashboard{}, nil
}

func (f *fakeBi_dashboardService) List(ctx context.Context, tenantID string) ([]models.BiDashboard, error) {
	return []models.BiDashboard{}, nil
}

func (f *fakeBi_dashboardService) Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.BiDashboard, error) {
	return &models.BiDashboard{}, nil
}

var _ service.ServiceInterface = (*fakeBi_dashboardService)(nil)
=======
type fakebi_dashboardService struct{}

func (f *fakebi_dashboardService) Create(ctx context.Context, req *models.CreateRequest, tenantID string) ((*models.BiDashboard, error)) {
	return &models.BiDashboard{}, nil
}

func (f *fakebi_dashboardService) Delete(ctx context.Context, id, tenantID string) ((bool, error)) {
	return false, nil
}

func (f *fakebi_dashboardService) Get(ctx context.Context, id, tenantID string) ((*models.BiDashboard, error)) {
	return &models.BiDashboard{}, nil
}

func (f *fakebi_dashboardService) List(ctx context.Context, tenantID string) (([]models.BiDashboard, error)) {
	return []models.BiDashboard{}, nil
}

func (f *fakebi_dashboardService) Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) ((*models.BiDashboard, error)) {
	return &models.BiDashboard{}, nil
}

var _ service.ServiceInterface = (*fakebi_dashboardService)(nil)
>>>>>>> Stashed changes


func TestBI_DASHBOARD_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestBI_DASHBOARD_Handler_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}

func TestBI_DASHBOARD_Handler_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}

func TestBI_DASHBOARD_Handler_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}

func TestBI_DASHBOARD_Handler_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}

func TestBI_DASHBOARD_Handler_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}

func TestBI_DASHBOARD_Handler_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
