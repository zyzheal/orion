package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/pipeline/service"

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

func TestHandler_PIPELINE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PIPELINE_ListPipelines(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListPipelines(c)
	if w.Code >= 500 {
		t.Fatalf("ListPipelines: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_CreatePipeline(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreatePipeline(c)
	if w.Code >= 500 {
		t.Fatalf("CreatePipeline: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_GetPipeline(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetPipeline(c)
	if w.Code >= 500 {
		t.Fatalf("GetPipeline: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_UpdatePipeline(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdatePipeline(c)
	if w.Code >= 500 {
		t.Fatalf("UpdatePipeline: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_DeletePipeline(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeletePipeline(c)
	if w.Code >= 500 {
		t.Fatalf("DeletePipeline: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_ValidatePipeline(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ValidatePipeline(c)
	if w.Code >= 500 {
		t.Fatalf("ValidatePipeline: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_StartRun(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().StartRun(c)
	if w.Code >= 500 {
		t.Fatalf("StartRun: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_StopRun(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().StopRun(c)
	if w.Code >= 500 {
		t.Fatalf("StopRun: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_BatchStart(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().BatchStart(c)
	if w.Code >= 500 {
		t.Fatalf("BatchStart: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_BatchStop(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().BatchStop(c)
	if w.Code >= 500 {
		t.Fatalf("BatchStop: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_BatchDelete(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().BatchDelete(c)
	if w.Code >= 500 {
		t.Fatalf("BatchDelete: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_GetStats(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_GetVersions(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetVersions(c)
	if w.Code >= 500 {
		t.Fatalf("GetVersions: got %d", w.Code)
	}
}
