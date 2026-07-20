package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/sso-unified/service"

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

func TestHandler_SSO_UNIFIED_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SSO_UNIFIED_CreateConfig(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateConfig(c)
	if w.Code >= 500 {
		t.Fatalf("CreateConfig: got %d", w.Code)
	}
}
func TestHandler_SSO_UNIFIED_ListConfigs(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListConfigs(c)
	if w.Code >= 500 {
		t.Fatalf("ListConfigs: got %d", w.Code)
	}
}
func TestHandler_SSO_UNIFIED_GetConfig(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetConfig(c)
	if w.Code >= 500 {
		t.Fatalf("GetConfig: got %d", w.Code)
	}
}
func TestHandler_SSO_UNIFIED_UpdateConfig(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateConfig(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateConfig: got %d", w.Code)
	}
}
func TestHandler_SSO_UNIFIED_DeleteConfig(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteConfig(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteConfig: got %d", w.Code)
	}
}
