package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/metrics/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/metrics/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeMetricsService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeMetricsService struct{}

func (f *fakeMetricsService) Create(ctx context.Context, tenantID string, req models.CreateMetricsRequest) (*models.Metrics, error) {
	return &models.Metrics{}, nil
}

func (f *fakeMetricsService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeMetricsService) Get(ctx context.Context, tenantID, id string) (*models.Metrics, error) {
	return &models.Metrics{}, nil
}

func (f *fakeMetricsService) List(ctx context.Context, tenantID string) ([]models.Metrics, error) {
	return []models.Metrics{}, nil
}

func (f *fakeMetricsService) Update(ctx context.Context, tenantID, id string, req models.UpdateMetricsRequest) (*models.Metrics, error) {
	return &models.Metrics{}, nil
}

var _ service.ServiceInterface = (*fakeMetricsService)(nil)


func TestHandler_METRICS_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_METRICS_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_METRICS_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_METRICS_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_METRICS_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_METRICS_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
