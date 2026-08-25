package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/service-health/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/service-health/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeService_healthService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeService_healthService struct{}

func (f *fakeService_healthService) Create(ctx context.Context, tenantID string, req models.CreateHealthCheckRequest) (*models.HealthCheck, error) {
	return &models.HealthCheck{}, nil
}

func (f *fakeService_healthService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeService_healthService) DetectDegradedServices(ctx context.Context, tenantID string, thresholdUptime float64) ([]models.HealthSummary, error) {
	return []models.HealthSummary{}, nil
}

func (f *fakeService_healthService) Get(ctx context.Context, tenantID, id string) (*models.HealthCheck, error) {
	return &models.HealthCheck{}, nil
}

func (f *fakeService_healthService) GetAllHealthSummaries(ctx context.Context, tenantID string) ([]models.HealthSummary, error) {
	return []models.HealthSummary{}, nil
}

func (f *fakeService_healthService) GetRecentResults(ctx context.Context, checkID string, limit int) ([]models.HealthResult, error) {
	return []models.HealthResult{}, nil
}

func (f *fakeService_healthService) GetServiceHealth(ctx context.Context, tenantID, serviceName string) (*models.HealthSummary, error) {
	return &models.HealthSummary{}, nil
}

func (f *fakeService_healthService) List(ctx context.Context, tenantID string) ([]models.HealthCheck, error) {
	return []models.HealthCheck{}, nil
}

func (f *fakeService_healthService) RecordHealthResult(ctx context.Context, checkID string, status models.LastStatus, responseTimeMs int64, errMsg string) (*models.HealthCheck, error) {
	return &models.HealthCheck{}, nil
}

func (f *fakeService_healthService) Update(ctx context.Context, tenantID, id string, req models.UpdateHealthCheckRequest) (*models.HealthCheck, error) {
	return &models.HealthCheck{}, nil
}

var _ service.ServiceInterface = (*fakeService_healthService)(nil)


func TestHandler_SERVICE_HEALTH_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SERVICE_HEAL_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_SERVICE_HEAL_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_SERVICE_HEAL_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_SERVICE_HEAL_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_SERVICE_HEAL_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_SERVICE_HEAL_RecordResult(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RecordResult(c)
	if w.Code >= 500 {
		t.Fatalf("RecordResult: got %d", w.Code)
	}
}
func TestHandler_SERVICE_HEAL_GetResults(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetResults(c)
	if w.Code >= 500 {
		t.Fatalf("GetResults: got %d", w.Code)
	}
}
func TestHandler_SERVICE_HEAL_GetServiceHealth(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetServiceHealth(c)
	if w.Code >= 500 {
		t.Fatalf("GetServiceHealth: got %d", w.Code)
	}
}
func TestHandler_SERVICE_HEAL_GetAllSummaries(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetAllSummaries(c)
	if w.Code >= 500 {
		t.Fatalf("GetAllSummaries: got %d", w.Code)
	}
}
func TestHandler_SERVICE_HEAL_DegradedServices(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DegradedServices(c)
	if w.Code >= 500 {
		t.Fatalf("DegradedServices: got %d", w.Code)
	}
}
