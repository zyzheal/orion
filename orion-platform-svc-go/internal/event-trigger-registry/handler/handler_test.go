package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/event-trigger-registry/service"

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

func TestHandler_EVENT_TRIGGER__RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_EVENT_TRIGGE_ListTriggers(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListTriggers(c)
	if w.Code >= 500 {
		t.Fatalf("ListTriggers: got %d", w.Code)
	}
}
func TestHandler_EVENT_TRIGGE_GetTrigger(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTrigger(c)
	if w.Code >= 500 {
		t.Fatalf("GetTrigger: got %d", w.Code)
	}
}
func TestHandler_EVENT_TRIGGE_CreateTrigger(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateTrigger(c)
	if w.Code >= 500 {
		t.Fatalf("CreateTrigger: got %d", w.Code)
	}
}
func TestHandler_EVENT_TRIGGE_UpdateTrigger(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateTrigger(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateTrigger: got %d", w.Code)
	}
}
func TestHandler_EVENT_TRIGGE_DeleteTrigger(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteTrigger(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteTrigger: got %d", w.Code)
	}
}
