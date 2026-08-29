package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/tracing/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/tracing/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeTracingService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeTracingService struct{}

func (f *fakeTracingService) CreateOtelConfig(ctx context.Context, tenantID string, req *models.CreateOtelRequest) (*models.OtelCollectorConfig, error) {
	return &models.OtelCollectorConfig{}, nil
}

func (f *fakeTracingService) DeleteOtelConfig(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeTracingService) GetOtelConfig(ctx context.Context, tenantID, id string) (*models.OtelCollectorConfig, error) {
	return &models.OtelCollectorConfig{}, nil
}

func (f *fakeTracingService) GetOtelConfigs(ctx context.Context, tenantID, configType string) ([]models.OtelCollectorConfig, error) {
	return []models.OtelCollectorConfig{}, nil
}

func (f *fakeTracingService) GetSamplingConfigs(ctx context.Context, tenantID string) ([]models.TraceSamplingConfig, error) {
	return []models.TraceSamplingConfig{}, nil
}

func (f *fakeTracingService) GetTrace(ctx context.Context, tenantID, traceID string) ([]models.TraceSpan, error) {
	return []models.TraceSpan{}, nil
}

func (f *fakeTracingService) GetTraceList(ctx context.Context, tenantID string, serviceName string, limit int) ([]models.TraceSpan, error) {
	return []models.TraceSpan{}, nil
}

func (f *fakeTracingService) SearchTraces(ctx context.Context, tenantID string, req *models.TraceSearchRequest) ([]models.TraceSpan, error) {
	return []models.TraceSpan{}, nil
}

func (f *fakeTracingService) UpdateOtelConfig(ctx context.Context, tenantID, id string, req *models.UpdateOtelRequest) (*models.OtelCollectorConfig, error) {
	return &models.OtelCollectorConfig{}, nil
}

func (f *fakeTracingService) UpsertSamplingConfig(ctx context.Context, tenantID string, req *models.UpsertSamplingRequest) (*models.TraceSamplingConfig, error) {
	return &models.TraceSamplingConfig{}, nil
}

var _ service.ServiceInterface = (*fakeTracingService)(nil)

func TestHandler_TRACING_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_TRACING_ListTraces(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListTraces(c)
	if w.Code >= 500 {
		t.Fatalf("ListTraces: got %d", w.Code)
	}
}
func TestHandler_TRACING_GetTrace(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTrace(c)
	if w.Code >= 500 {
		t.Fatalf("GetTrace: got %d", w.Code)
	}
}
func TestHandler_TRACING_GetTraceSpans(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTraceSpans(c)
	if w.Code >= 500 {
		t.Fatalf("GetTraceSpans: got %d", w.Code)
	}
}
func TestHandler_TRACING_SearchTraces(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SearchTraces(c)
	if w.Code >= 500 {
		t.Fatalf("SearchTraces: got %d", w.Code)
	}
}
func TestHandler_TRACING_GetSamplingConfigs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSamplingConfigs(c)
	if w.Code >= 500 {
		t.Fatalf("GetSamplingConfigs: got %d", w.Code)
	}
}
func TestHandler_TRACING_UpdateSamplingConfig(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateSamplingConfig(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateSamplingConfig: got %d", w.Code)
	}
}
func TestHandler_TRACING_GetOtelConfigs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetOtelConfigs(c)
	if w.Code >= 500 {
		t.Fatalf("GetOtelConfigs: got %d", w.Code)
	}
}
func TestHandler_TRACING_CreateOtelConfig(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateOtelConfig(c)
	if w.Code >= 500 {
		t.Fatalf("CreateOtelConfig: got %d", w.Code)
	}
}
func TestHandler_TRACING_UpdateOtelConfig(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateOtelConfig(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateOtelConfig: got %d", w.Code)
	}
}
func TestHandler_TRACING_DeleteOtelConfig(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteOtelConfig(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteOtelConfig: got %d", w.Code)
	}
}
