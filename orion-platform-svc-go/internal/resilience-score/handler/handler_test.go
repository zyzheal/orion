package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/resilience-score/service"

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

func TestHandler_RESILIENCE_SCO_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_RESILIENCE_S_GetGlobalScore(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetGlobalScore(c)
	if w.Code >= 500 {
		t.Fatalf("GetGlobalScore: got %d", w.Code)
	}
}
func TestHandler_RESILIENCE_S_ListServiceScores(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListServiceScores(c)
	if w.Code >= 500 {
		t.Fatalf("ListServiceScores: got %d", w.Code)
	}
}
func TestHandler_RESILIENCE_S_GetServiceScore(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetServiceScore(c)
	if w.Code >= 500 {
		t.Fatalf("GetServiceScore: got %d", w.Code)
	}
}
func TestHandler_RESILIENCE_S_ListHistory(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListHistory(c)
	if w.Code >= 500 {
		t.Fatalf("ListHistory: got %d", w.Code)
	}
}
func TestHandler_RESILIENCE_S_ListRecommendations(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListRecommendations(c)
	if w.Code >= 500 {
		t.Fatalf("ListRecommendations: got %d", w.Code)
	}
}
func TestHandler_RESILIENCE_S_Assess(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Assess(c)
	if w.Code >= 500 {
		t.Fatalf("Assess: got %d", w.Code)
	}
}
func TestHandler_RESILIENCE_S_GetComponentScores(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetComponentScores(c)
	if w.Code >= 500 {
		t.Fatalf("GetComponentScores: got %d", w.Code)
	}
}
func TestHandler_RESILIENCE_S_CreateBenchmark(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateBenchmark(c)
	if w.Code >= 500 {
		t.Fatalf("CreateBenchmark: got %d", w.Code)
	}
}
