package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/user-status/service"

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

func TestHandler_USER_STATUS_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_USER_STATUS_GetMyStatus(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetMyStatus(c)
	if w.Code >= 500 {
		t.Fatalf("GetMyStatus: got %d", w.Code)
	}
}
func TestHandler_USER_STATUS_GetStatus(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStatus(c)
	if w.Code >= 500 {
		t.Fatalf("GetStatus: got %d", w.Code)
	}
}
func TestHandler_USER_STATUS_SetMyStatus(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SetMyStatus(c)
	if w.Code >= 500 {
		t.Fatalf("SetMyStatus: got %d", w.Code)
	}
}
func TestHandler_USER_STATUS_ListOnline(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListOnline(c)
	if w.Code >= 500 {
		t.Fatalf("ListOnline: got %d", w.Code)
	}
}
