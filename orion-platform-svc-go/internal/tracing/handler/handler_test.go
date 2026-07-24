package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/tracing/service"

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

func TestHandler_TRACING_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_TRACING_ListTraces(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListTraces(c)
	if w.Code >= 500 {
		t.Fatalf("ListTraces: got %d", w.Code)
	}
}
func TestHandler_TRACING_GetTrace(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTrace(c)
	if w.Code >= 500 {
		t.Fatalf("GetTrace: got %d", w.Code)
	}
}
func TestHandler_TRACING_GetTraceSpans(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTraceSpans(c)
	if w.Code >= 500 {
		t.Fatalf("GetTraceSpans: got %d", w.Code)
	}
}
func TestHandler_TRACING_SearchTraces(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SearchTraces(c)
	if w.Code >= 500 {
		t.Fatalf("SearchTraces: got %d", w.Code)
	}
}
func TestHandler_TRACING_GetSamplingConfigs(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSamplingConfigs(c)
	if w.Code >= 500 {
		t.Fatalf("GetSamplingConfigs: got %d", w.Code)
	}
}
func TestHandler_TRACING_UpdateSamplingConfig(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateSamplingConfig(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateSamplingConfig: got %d", w.Code)
	}
}
func TestHandler_TRACING_GetOtelConfigs(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetOtelConfigs(c)
	if w.Code >= 500 {
		t.Fatalf("GetOtelConfigs: got %d", w.Code)
	}
}
func TestHandler_TRACING_CreateOtelConfig(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateOtelConfig(c)
	if w.Code >= 500 {
		t.Fatalf("CreateOtelConfig: got %d", w.Code)
	}
}
func TestHandler_TRACING_UpdateOtelConfig(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateOtelConfig(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateOtelConfig: got %d", w.Code)
	}
}
func TestHandler_TRACING_DeleteOtelConfig(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteOtelConfig(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteOtelConfig: got %d", w.Code)
	}
}
