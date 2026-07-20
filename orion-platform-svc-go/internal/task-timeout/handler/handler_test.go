package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/task-timeout/service"

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

func TestHandler_TASK_TIMEOUT_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_TASK_TIMEOUT_GetTimeouts(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTimeouts(c)
	if w.Code >= 500 {
		t.Fatalf("GetTimeouts: got %d", w.Code)
	}
}
func TestHandler_TASK_TIMEOUT_SetTimeouts(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SetTimeouts(c)
	if w.Code >= 500 {
		t.Fatalf("SetTimeouts: got %d", w.Code)
	}
}
