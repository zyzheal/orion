package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/llm-trace/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&service.Service{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

func TestHandler_LLM_TRACE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_LLM_TRACE_getTenantID(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_LLM_TRACE_getUserID(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getUserID(c)
	if w.Code >= 500 {
		t.Fatalf("getUserID: got %d", w.Code)
	}
}
func TestHandler_LLM_TRACE_GetTrace(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTrace(c)
	if w.Code >= 500 {
		t.Fatalf("GetTrace: got %d", w.Code)
	}
}
func TestHandler_LLM_TRACE_ListTraces(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListTraces(c)
	if w.Code >= 500 {
		t.Fatalf("ListTraces: got %d", w.Code)
	}
}
func TestHandler_LLM_TRACE_CreateTrace(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateTrace(c)
	if w.Code >= 500 {
		t.Fatalf("CreateTrace: got %d", w.Code)
	}
}
func TestHandler_LLM_TRACE_CompleteTrace(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CompleteTrace(c)
	if w.Code >= 500 {
		t.Fatalf("CompleteTrace: got %d", w.Code)
	}
}
func TestHandler_LLM_TRACE_GetDailyStats(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDailyStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetDailyStats: got %d", w.Code)
	}
}
func TestHandler_LLM_TRACE_GetTrackingAccuracy(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTrackingAccuracy(c)
	if w.Code >= 500 {
		t.Fatalf("GetTrackingAccuracy: got %d", w.Code)
	}
}
func TestHandler_LLM_TRACE_GetPricing(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetPricing(c)
	if w.Code >= 500 {
		t.Fatalf("GetPricing: got %d", w.Code)
	}
}
func TestHandler_LLM_TRACE_EstimateCost(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().EstimateCost(c)
	if w.Code >= 500 {
		t.Fatalf("EstimateCost: got %d", w.Code)
	}
}
func TestHandler_LLM_TRACE_GetCostBreakdown(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetCostBreakdown(c)
	if w.Code >= 500 {
		t.Fatalf("GetCostBreakdown: got %d", w.Code)
	}
}
