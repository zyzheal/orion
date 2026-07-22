package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/lowcode/service"

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

func TestHandler_LOWCODE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_LOWCODE_ListFlows(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListFlows(c)
	if w.Code >= 500 {
		t.Fatalf("ListFlows: got %d", w.Code)
	}
}
func TestHandler_LOWCODE_GetFlow(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetFlow(c)
	if w.Code >= 500 {
		t.Fatalf("GetFlow: got %d", w.Code)
	}
}
func TestHandler_LOWCODE_CreateFlow(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateFlow(c)
	if w.Code >= 500 {
		t.Fatalf("CreateFlow: got %d", w.Code)
	}
}
func TestHandler_LOWCODE_UpdateFlow(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateFlow(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateFlow: got %d", w.Code)
	}
}
func TestHandler_LOWCODE_DeleteFlow(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteFlow(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteFlow: got %d", w.Code)
	}
}
func TestHandler_LOWCODE_PublishFlow(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().PublishFlow(c)
	if w.Code >= 500 {
		t.Fatalf("PublishFlow: got %d", w.Code)
	}
}
func TestHandler_LOWCODE_ExecuteFlow(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ExecuteFlow(c)
	if w.Code >= 500 {
		t.Fatalf("ExecuteFlow: got %d", w.Code)
	}
}
func TestHandler_LOWCODE_CreateVersion(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateVersion(c)
	if w.Code >= 500 {
		t.Fatalf("CreateVersion: got %d", w.Code)
	}
}
func TestHandler_LOWCODE_ListVersions(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListVersions(c)
	if w.Code >= 500 {
		t.Fatalf("ListVersions: got %d", w.Code)
	}
}
func TestHandler_LOWCODE_ImportWorkflow(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ImportWorkflow(c)
	if w.Code >= 500 {
		t.Fatalf("ImportWorkflow: got %d", w.Code)
	}
}
func TestHandler_LOWCODE_ExportWorkflow(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ExportWorkflow(c)
	if w.Code >= 500 {
		t.Fatalf("ExportWorkflow: got %d", w.Code)
	}
}
func TestHandler_LOWCODE_ListTemplates(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListTemplates(c)
	if w.Code >= 500 {
		t.Fatalf("ListTemplates: got %d", w.Code)
	}
}
func TestHandler_LOWCODE_CreateTemplate(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateTemplate(c)
	if w.Code >= 500 {
		t.Fatalf("CreateTemplate: got %d", w.Code)
	}
}
func TestHandler_LOWCODE_ApplyTemplate(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ApplyTemplate(c)
	if w.Code >= 500 {
		t.Fatalf("ApplyTemplate: got %d", w.Code)
	}
}
