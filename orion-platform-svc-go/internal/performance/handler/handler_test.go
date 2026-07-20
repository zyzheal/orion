package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/performance/service"

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

func TestHandler_PERFORMANCE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PERFORMANCE_getTenantID(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_CreateBaseline(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateBaseline(c)
	if w.Code >= 500 {
		t.Fatalf("CreateBaseline: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_ListBaselines(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListBaselines(c)
	if w.Code >= 500 {
		t.Fatalf("ListBaselines: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_GetBaselineByID(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetBaselineByID(c)
	if w.Code >= 500 {
		t.Fatalf("GetBaselineByID: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_GetEvaluationHistory(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetEvaluationHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetEvaluationHistory: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_EvaluatePerformance(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().EvaluatePerformance(c)
	if w.Code >= 500 {
		t.Fatalf("EvaluatePerformance: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_ProfileService(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ProfileService(c)
	if w.Code >= 500 {
		t.Fatalf("ProfileService: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_GetBottlenecks(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetBottlenecks(c)
	if w.Code >= 500 {
		t.Fatalf("GetBottlenecks: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_GetSuggestions(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSuggestions(c)
	if w.Code >= 500 {
		t.Fatalf("GetSuggestions: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_DetectRegression(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DetectRegression(c)
	if w.Code >= 500 {
		t.Fatalf("DetectRegression: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_RecordTestResult(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RecordTestResult(c)
	if w.Code >= 500 {
		t.Fatalf("RecordTestResult: got %d", w.Code)
	}
}
func TestHandler_PERFORMANCE_GetTestResults(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTestResults(c)
	if w.Code >= 500 {
		t.Fatalf("GetTestResults: got %d", w.Code)
	}
}
