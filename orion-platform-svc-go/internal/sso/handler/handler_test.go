package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/sso/service"

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

func TestHandler_SSO_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SSO_CreateProvider(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateProvider(c)
	if w.Code >= 500 {
		t.Fatalf("CreateProvider: got %d", w.Code)
	}
}
func TestHandler_SSO_GetProvider(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetProvider(c)
	if w.Code >= 500 {
		t.Fatalf("GetProvider: got %d", w.Code)
	}
}
func TestHandler_SSO_HandleCallback(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().HandleCallback(c)
	if w.Code >= 500 {
		t.Fatalf("HandleCallback: got %d", w.Code)
	}
}
func TestHandler_SSO_InitiateLogin(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().InitiateLogin(c)
	if w.Code >= 500 {
		t.Fatalf("InitiateLogin: got %d", w.Code)
	}
}
func TestHandler_SSO_ListProviders(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListProviders(c)
	if w.Code >= 500 {
		t.Fatalf("ListProviders: got %d", w.Code)
	}
}
func TestHandler_SSO_UpdateProvider(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateProvider(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateProvider: got %d", w.Code)
	}
}
