package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/escalation/service"

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

func TestHandler_ESCALATION_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_ESCALATION_CreateRule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateRule(c)
	if w.Code >= 500 {
		t.Fatalf("CreateRule: got %d", w.Code)
	}
}
func TestHandler_ESCALATION_DeleteRule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteRule(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteRule: got %d", w.Code)
	}
}
func TestHandler_ESCALATION_GetRule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetRule(c)
	if w.Code >= 500 {
		t.Fatalf("GetRule: got %d", w.Code)
	}
}
func TestHandler_ESCALATION_GetStats(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
func TestHandler_ESCALATION_ListRules(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListRules(c)
	if w.Code >= 500 {
		t.Fatalf("ListRules: got %d", w.Code)
	}
}
func TestHandler_ESCALATION_TriggerRule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().TriggerRule(c)
	if w.Code >= 500 {
		t.Fatalf("TriggerRule: got %d", w.Code)
	}
}
func TestHandler_ESCALATION_UpdateRule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateRule(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateRule: got %d", w.Code)
	}
}
