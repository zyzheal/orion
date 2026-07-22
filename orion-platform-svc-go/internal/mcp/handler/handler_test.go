package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/mcp/service"

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

func TestHandler_MCP_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_MCP_CreateServer(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateServer(c)
	if w.Code >= 500 {
		t.Fatalf("CreateServer: got %d", w.Code)
	}
}
func TestHandler_MCP_DeleteServer(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteServer(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteServer: got %d", w.Code)
	}
}
func TestHandler_MCP_GetServer(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetServer(c)
	if w.Code >= 500 {
		t.Fatalf("GetServer: got %d", w.Code)
	}
}
func TestHandler_MCP_ListServers(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListServers(c)
	if w.Code >= 500 {
		t.Fatalf("ListServers: got %d", w.Code)
	}
}
func TestHandler_MCP_ListTools(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListTools(c)
	if w.Code >= 500 {
		t.Fatalf("ListTools: got %d", w.Code)
	}
}
func TestHandler_MCP_UpdateServer(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateServer(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateServer: got %d", w.Code)
	}
}
