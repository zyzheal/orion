package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"orion/platform-svc-go/internal/llm-trace/models"
	"orion/platform-svc-go/internal/llm-trace/service"

	"github.com/gin-gonic/gin"
)

type fakeLLMTraceService struct {
	createCalled bool
	deleteCalled bool
}

func (f *fakeLLMTraceService) CreateTrace(ctx context.Context, tenantID string, userID string, req *models.TraceCreateRequest) (*models.LLMTrace, error) {
	f.createCalled = true
	return &models.LLMTrace{ID: "trace-1"}, nil
}
func (f *fakeLLMTraceService) GetTrace(ctx context.Context, traceID string, tenantID string) (*models.LLMTrace, error) {
	return &models.LLMTrace{ID: traceID}, nil
}
func (f *fakeLLMTraceService) ListTraces(ctx context.Context, tenantID string, q *models.ListTracesQuery) ([]models.LLMTrace, int64, error) {
	return []models.LLMTrace{}, 0, nil
}
func (f *fakeLLMTraceService) CompleteTrace(ctx context.Context, traceID string, tenantID string, req *models.TraceCompleteRequest) (*models.LLMTrace, error) {
	return &models.LLMTrace{ID: traceID}, nil
}
func (f *fakeLLMTraceService) DeleteTrace(ctx context.Context, traceID string, tenantID string) error {
	f.deleteCalled = true
	return nil
}
func (f *fakeLLMTraceService) GetDailyStats(ctx context.Context, tenantID string, date *string) (*models.DailyStats, error) {
	return &models.DailyStats{}, nil
}
func (f *fakeLLMTraceService) GetTrackingAccuracy(ctx context.Context, tenantID string) (*models.TrackingAccuracy, error) {
	return &models.TrackingAccuracy{}, nil
}
func (f *fakeLLMTraceService) GetAllPricing(ctx context.Context) map[string]models.ModelPricing {
	return map[string]models.ModelPricing{}
}
func (f *fakeLLMTraceService) CalculateCost(ctx context.Context, modelID string, inputTokens int, outputTokens int) *models.CostBreakdown {
	return &models.CostBreakdown{}
}
func (f *fakeLLMTraceService) CalculateBatchCost(ctx context.Context, traces []models.LLMTrace) *models.CostBreakdown {
	return &models.CostBreakdown{}
}
func (f *fakeLLMTraceService) GetCostBreakdown(ctx context.Context, tenantID string, q *models.CostBreakdownQuery) (*models.CostBreakdown, int64, error) {
	return &models.CostBreakdown{}, 0, nil
}
func (f *fakeLLMTraceService) GetUsageDashboard(ctx context.Context, tenantID string, start *time.Time, end *time.Time) (*models.UsageDashboard, error) {
	return &models.UsageDashboard{}, nil
}
func (f *fakeLLMTraceService) GetModuleCostDashboard(ctx context.Context, tenantID string, start *time.Time, end *time.Time) ([]service.ModuleCostSummary, error) {
	return []service.ModuleCostSummary{}, nil
}

var _ service.ServiceInterface = (*fakeLLMTraceService)(nil)

func newHandler() *Handler {
	return NewHandler(&service.Service{})
}

func makeCtxLLM(method string, path string, body interface{}, params map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
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

func TestHandler_LLM_TRACE_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group(""))
}

func TestHandler_LLM_TRACE_GetTrace(t *testing.T) {
	fake := &fakeLLMTraceService{}
	h := NewHandler(fake)
	c, w := makeCtxLLM(http.MethodGet, "/api/v1/llm/traces/trace-1", nil, map[string]string{"traceId": "trace-1"})
	h.GetTrace(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetTrace: got %d", w.Code)
	}
}

func TestHandler_LLM_TRACE_ListTraces(t *testing.T) {
	fake := &fakeLLMTraceService{}
	h := NewHandler(fake)
	c, w := makeCtxLLM(http.MethodGet, "/api/v1/llm/traces", nil, nil)
	h.ListTraces(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListTraces: got %d", w.Code)
	}
}

func TestHandler_LLM_TRACE_CreateTrace(t *testing.T) {
	fake := &fakeLLMTraceService{}
	h := NewHandler(fake)
	c, w := makeCtxLLM(http.MethodPost, "/api/v1/llm/traces", models.TraceCreateRequest{
		ModelID:       "gpt-4",
		PromptContent: "hello",
	}, nil)
	h.CreateTrace(c)
	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Fatalf("CreateTrace: got %d", w.Code)
	}
	if !fake.createCalled {
		t.Fatal("CreateTrace service not called")
	}
}

func TestHandler_LLM_TRACE_CompleteTrace(t *testing.T) {
	fake := &fakeLLMTraceService{}
	h := NewHandler(fake)
	c, w := makeCtxLLM(http.MethodPost, "/api/v1/llm/traces/trace-1/complete", models.TraceCompleteRequest{
		OutputContent: "response",
		InputTokens:   100,
		OutputTokens:  50,
	}, map[string]string{"traceId": "trace-1"})
	h.CompleteTrace(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CompleteTrace: got %d", w.Code)
	}
}

func TestHandler_LLM_TRACE_GetDailyStats(t *testing.T) {
	fake := &fakeLLMTraceService{}
	h := NewHandler(fake)
	c, w := makeCtxLLM(http.MethodGet, "/api/v1/llm/stats/daily", nil, nil)
	h.GetDailyStats(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetDailyStats: got %d", w.Code)
	}
}

func TestHandler_LLM_TRACE_GetTrackingAccuracy(t *testing.T) {
	fake := &fakeLLMTraceService{}
	h := NewHandler(fake)
	c, w := makeCtxLLM(http.MethodGet, "/api/v1/llm/tracking/accuracy", nil, nil)
	h.GetTrackingAccuracy(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetTrackingAccuracy: got %d", w.Code)
	}
}

func TestHandler_LLM_TRACE_GetPricing(t *testing.T) {
	fake := &fakeLLMTraceService{}
	h := NewHandler(fake)
	c, w := makeCtxLLM(http.MethodGet, "/api/v1/llm/pricing", nil, nil)
	h.GetPricing(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetPricing: got %d", w.Code)
	}
}

func TestHandler_LLM_TRACE_EstimateCost(t *testing.T) {
	fake := &fakeLLMTraceService{}
	h := NewHandler(fake)
	c, w := makeCtxLLM(http.MethodPost, "/api/v1/llm/cost/estimate", models.CostEstimateRequest{
		ModelID:      "gpt-4",
		InputTokens:  100,
		OutputTokens: 50,
	}, nil)
	h.EstimateCost(c)
	if w.Code != http.StatusOK {
		t.Fatalf("EstimateCost: got %d", w.Code)
	}
}

func TestHandler_LLM_TRACE_GetCostBreakdown(t *testing.T) {
	fake := &fakeLLMTraceService{}
	h := NewHandler(fake)
	c, w := makeCtxLLM(http.MethodGet, "/api/v1/llm/cost/breakdown", nil, nil)
	h.GetCostBreakdown(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetCostBreakdown: got %d", w.Code)
	}
}

func TestHandler_LLM_TRACE_GetUsageDashboard(t *testing.T) {
	fake := &fakeLLMTraceService{}
	h := NewHandler(fake)
	c, w := makeCtxLLM(http.MethodGet, "/api/v1/llm/usage/dashboard", nil, nil)
	h.GetUsageDashboard(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetUsageDashboard: got %d", w.Code)
	}
}

func TestHandler_LLM_TRACE_GetModuleCostDashboard(t *testing.T) {
	fake := &fakeLLMTraceService{}
	h := NewHandler(fake)
	c, w := makeCtxLLM(http.MethodGet, "/api/v1/llm/cost/module-dashboard", nil, nil)
	h.GetModuleCostDashboard(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetModuleCostDashboard: got %d", w.Code)
	}
}

func TestHandler_LLM_TRACE_getTenantID(t *testing.T) {
	fake := &fakeLLMTraceService{}
	h := NewHandler(fake)
	c, _ := makeCtxLLM(http.MethodGet, "/", nil, nil)
	got := h.getTenantID(c)
	if got != "tenant-1" {
		t.Fatalf("getTenantID: got %q", got)
	}
}

func TestHandler_LLM_TRACE_getUserID(t *testing.T) {
	fake := &fakeLLMTraceService{}
	h := NewHandler(fake)
	c, _ := makeCtxLLM(http.MethodGet, "/", nil, nil)
	got := h.getUserID(c)
	if got != "system" {
		t.Fatalf("getUserID: got %q, want system", got)
	}
}
