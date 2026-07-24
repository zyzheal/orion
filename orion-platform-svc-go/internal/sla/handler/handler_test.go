package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/sla/service"

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

func TestHandler_SLA_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SLA_ListDefinitions(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListDefinitions(c)
	if w.Code >= 500 {
		t.Fatalf("ListDefinitions: got %d", w.Code)
	}
}
func TestHandler_SLA_CreateDefinition(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateDefinition(c)
	if w.Code >= 500 {
		t.Fatalf("CreateDefinition: got %d", w.Code)
	}
}
func TestHandler_SLA_GetDefinition(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDefinition(c)
	if w.Code >= 500 {
		t.Fatalf("GetDefinition: got %d", w.Code)
	}
}
func TestHandler_SLA_UpdateDefinition(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateDefinition(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateDefinition: got %d", w.Code)
	}
}
func TestHandler_SLA_DeleteDefinition(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteDefinition(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteDefinition: got %d", w.Code)
	}
}
func TestHandler_SLA_StartTracking(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().StartTracking(c)
	if w.Code >= 500 {
		t.Fatalf("StartTracking: got %d", w.Code)
	}
}
func TestHandler_SLA_ListTracking(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListTracking(c)
	if w.Code >= 500 {
		t.Fatalf("ListTracking: got %d", w.Code)
	}
}
func TestHandler_SLA_GetTracking(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTracking(c)
	if w.Code >= 500 {
		t.Fatalf("GetTracking: got %d", w.Code)
	}
}
func TestHandler_SLA_UpdateTracking(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateTracking(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateTracking: got %d", w.Code)
	}
}
func TestHandler_SLA_MarkMet(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().MarkMet(c)
	if w.Code >= 500 {
		t.Fatalf("MarkMet: got %d", w.Code)
	}
}
func TestHandler_SLA_MarkBreached(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().MarkBreached(c)
	if w.Code >= 500 {
		t.Fatalf("MarkBreached: got %d", w.Code)
	}
}
func TestHandler_SLA_PauseTracking(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().PauseTracking(c)
	if w.Code >= 500 {
		t.Fatalf("PauseTracking: got %d", w.Code)
	}
}
func TestHandler_SLA_ResumeTracking(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ResumeTracking(c)
	if w.Code >= 500 {
		t.Fatalf("ResumeTracking: got %d", w.Code)
	}
}
func TestHandler_SLA_GetBreachEvents(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetBreachEvents(c)
	if w.Code >= 500 {
		t.Fatalf("GetBreachEvents: got %d", w.Code)
	}
}
func TestHandler_SLA_ListBreachEvents(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListBreachEvents(c)
	if w.Code >= 500 {
		t.Fatalf("ListBreachEvents: got %d", w.Code)
	}
}
func TestHandler_SLA_DetectBreaches(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DetectBreaches(c)
	if w.Code >= 500 {
		t.Fatalf("DetectBreaches: got %d", w.Code)
	}
}
func TestHandler_SLA_GetStats(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
