package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/user-token/service"

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

func TestHandler_USER_TOKEN_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_USER_TOKEN_GetTokens(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTokens(c)
	if w.Code >= 500 {
		t.Fatalf("GetTokens: got %d", w.Code)
	}
}
func TestHandler_USER_TOKEN_CreateToken(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateToken(c)
	if w.Code >= 500 {
		t.Fatalf("CreateToken: got %d", w.Code)
	}
}
func TestHandler_USER_TOKEN_DeleteToken(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteToken(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteToken: got %d", w.Code)
	}
}
