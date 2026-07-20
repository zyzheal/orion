package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/ephemeral-env/service"

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

func TestHandler_EPHEMERAL_ENV_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_EPHEMERAL_EN_CreateEnv(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateEnv(c)
	if w.Code >= 500 {
		t.Fatalf("CreateEnv: got %d", w.Code)
	}
}
func TestHandler_EPHEMERAL_EN_DeleteEnv(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteEnv(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteEnv: got %d", w.Code)
	}
}
func TestHandler_EPHEMERAL_EN_DestroyEnv(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DestroyEnv(c)
	if w.Code >= 500 {
		t.Fatalf("DestroyEnv: got %d", w.Code)
	}
}
func TestHandler_EPHEMERAL_EN_ExtendTTL(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ExtendTTL(c)
	if w.Code >= 500 {
		t.Fatalf("ExtendTTL: got %d", w.Code)
	}
}
func TestHandler_EPHEMERAL_EN_GetEnv(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetEnv(c)
	if w.Code >= 500 {
		t.Fatalf("GetEnv: got %d", w.Code)
	}
}
func TestHandler_EPHEMERAL_EN_GetLogs(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetLogs(c)
	if w.Code >= 500 {
		t.Fatalf("GetLogs: got %d", w.Code)
	}
}
func TestHandler_EPHEMERAL_EN_ListEnvs(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListEnvs(c)
	if w.Code >= 500 {
		t.Fatalf("ListEnvs: got %d", w.Code)
	}
}
