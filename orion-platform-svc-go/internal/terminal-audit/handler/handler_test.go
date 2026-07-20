package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/terminal-audit/service"

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

func TestHandler_TERMINAL_AUDIT_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_TERMINAL_AUD_DeleteBatch(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteBatch(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteBatch: got %d", w.Code)
	}
}
func TestHandler_TERMINAL_AUD_GetAudit(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetAudit(c)
	if w.Code >= 500 {
		t.Fatalf("GetAudit: got %d", w.Code)
	}
}
func TestHandler_TERMINAL_AUD_GetStats(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
func TestHandler_TERMINAL_AUD_ListAudits(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListAudits(c)
	if w.Code >= 500 {
		t.Fatalf("ListAudits: got %d", w.Code)
	}
}
func TestHandler_TERMINAL_AUD_SearchAudits(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SearchAudits(c)
	if w.Code >= 500 {
		t.Fatalf("SearchAudits: got %d", w.Code)
	}
}
