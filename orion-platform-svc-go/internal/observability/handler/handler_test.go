package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/observability/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/observability/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeObservabilityService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeObservabilityService struct{}

func (f *fakeObservabilityService) CreateAlertRule(ctx context.Context, tenantID string, rule *models.AlertRule) (*models.AlertRule, error) {
	return &models.AlertRule{}, nil
}

func (f *fakeObservabilityService) GetMetric(ctx context.Context, tenantID, name string) (*models.Metric, error) {
	return &models.Metric{}, nil
}

func (f *fakeObservabilityService) ListAlertRules(ctx context.Context, tenantID string) ([]models.AlertRule, error) {
	return []models.AlertRule{}, nil
}

func (f *fakeObservabilityService) ListMetrics(ctx context.Context, tenantID string, q models.MetricQuery) ([]models.Metric, error) {
	return []models.Metric{}, nil
}

func (f *fakeObservabilityService) RecordMetric(ctx context.Context, tenantID string, m *models.Metric) (*models.Metric, error) {
	return &models.Metric{}, nil
}

var _ service.ServiceInterface = (*fakeObservabilityService)(nil)


func TestHandler_OBSERVABILITY_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_OBSERVABILIT_RecordMetric(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RecordMetric(c)
	if w.Code >= 500 {
		t.Fatalf("RecordMetric: got %d", w.Code)
	}
}
func TestHandler_OBSERVABILIT_ListMetrics(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("ListMetrics: got %d", w.Code)
	}
}
func TestHandler_OBSERVABILIT_GetMetric(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetMetric(c)
	if w.Code >= 500 {
		t.Fatalf("GetMetric: got %d", w.Code)
	}
}
func TestHandler_OBSERVABILIT_CreateAlert(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateAlert(c)
	if w.Code >= 500 {
		t.Fatalf("CreateAlert: got %d", w.Code)
	}
}
func TestHandler_OBSERVABILIT_ListAlerts(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListAlerts(c)
	if w.Code >= 500 {
		t.Fatalf("ListAlerts: got %d", w.Code)
	}
}
