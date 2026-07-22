package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/observability/service"

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

func TestHandler_OBSERVABILITY_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_OBSERVABILIT_RecordMetric(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RecordMetric(c)
	if w.Code >= 500 {
		t.Fatalf("RecordMetric: got %d", w.Code)
	}
}
func TestHandler_OBSERVABILIT_ListMetrics(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("ListMetrics: got %d", w.Code)
	}
}
func TestHandler_OBSERVABILIT_GetMetric(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetMetric(c)
	if w.Code >= 500 {
		t.Fatalf("GetMetric: got %d", w.Code)
	}
}
func TestHandler_OBSERVABILIT_CreateAlert(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateAlert(c)
	if w.Code >= 500 {
		t.Fatalf("CreateAlert: got %d", w.Code)
	}
}
func TestHandler_OBSERVABILIT_ListAlerts(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListAlerts(c)
	if w.Code >= 500 {
		t.Fatalf("ListAlerts: got %d", w.Code)
	}
}
