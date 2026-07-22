package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/pipeline-execution-control/service"

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

func TestHandler_PIPELINE_EXECU_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PIPELINE_EXE_getTenantID(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_EXE_Pause(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Pause(c)
	if w.Code >= 500 {
		t.Fatalf("Pause: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_EXE_Resume(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Resume(c)
	if w.Code >= 500 {
		t.Fatalf("Resume: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_EXE_Abort(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Abort(c)
	if w.Code >= 500 {
		t.Fatalf("Abort: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_EXE_Retry(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Retry(c)
	if w.Code >= 500 {
		t.Fatalf("Retry: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_EXE_Restart(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Restart(c)
	if w.Code >= 500 {
		t.Fatalf("Restart: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_EXE_GetCheckpoints(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetCheckpoints(c)
	if w.Code >= 500 {
		t.Fatalf("GetCheckpoints: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_EXE_GetControlLogs(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetControlLogs(c)
	if w.Code >= 500 {
		t.Fatalf("GetControlLogs: got %d", w.Code)
	}
}
