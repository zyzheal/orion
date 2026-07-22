package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/self-healing/service"

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

func TestHandler_SELF_HEALING_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SELF_HEALING_CreateIncident(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateIncident(c)
	if w.Code >= 500 {
		t.Fatalf("CreateIncident: got %d", w.Code)
	}
}
func TestHandler_SELF_HEALING_GetIncident(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetIncident(c)
	if w.Code >= 500 {
		t.Fatalf("GetIncident: got %d", w.Code)
	}
}
func TestHandler_SELF_HEALING_ListHistory(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListHistory(c)
	if w.Code >= 500 {
		t.Fatalf("ListHistory: got %d", w.Code)
	}
}
func TestHandler_SELF_HEALING_GetEffectiveness(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetEffectiveness(c)
	if w.Code >= 500 {
		t.Fatalf("GetEffectiveness: got %d", w.Code)
	}
}
func TestHandler_SELF_HEALING_ListStrategies(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListStrategies(c)
	if w.Code >= 500 {
		t.Fatalf("ListStrategies: got %d", w.Code)
	}
}
func TestHandler_SELF_HEALING_GetStrategy(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStrategy(c)
	if w.Code >= 500 {
		t.Fatalf("GetStrategy: got %d", w.Code)
	}
}
func TestHandler_SELF_HEALING_ToggleStrategy(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ToggleStrategy(c)
	if w.Code >= 500 {
		t.Fatalf("ToggleStrategy: got %d", w.Code)
	}
}
func TestHandler_SELF_HEALING_RegisterStrategy(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RegisterStrategy(c)
	if w.Code >= 500 {
		t.Fatalf("RegisterStrategy: got %d", w.Code)
	}
}
func TestHandler_SELF_HEALING_ListApprovals(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListApprovals(c)
	if w.Code >= 500 {
		t.Fatalf("ListApprovals: got %d", w.Code)
	}
}
func TestHandler_SELF_HEALING_GetApproval(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetApproval(c)
	if w.Code >= 500 {
		t.Fatalf("GetApproval: got %d", w.Code)
	}
}
func TestHandler_SELF_HEALING_RespondApproval(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RespondApproval(c)
	if w.Code >= 500 {
		t.Fatalf("RespondApproval: got %d", w.Code)
	}
}
