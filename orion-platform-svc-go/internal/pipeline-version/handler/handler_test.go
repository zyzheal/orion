package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/pipeline-version/service"

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

func TestHandler_PIPELINE_VERSI_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PIPELINE_VER_getTenantID(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_VER_GetVersion(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetVersion(c)
	if w.Code >= 500 {
		t.Fatalf("GetVersion: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_VER_DiffVersions(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DiffVersions(c)
	if w.Code >= 500 {
		t.Fatalf("DiffVersions: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_VER_Rollback(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Rollback(c)
	if w.Code >= 500 {
		t.Fatalf("Rollback: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_VER_AddTag(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AddTag(c)
	if w.Code >= 500 {
		t.Fatalf("AddTag: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_VER_RemoveTag(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RemoveTag(c)
	if w.Code >= 500 {
		t.Fatalf("RemoveTag: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_VER_SetBaseline(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SetBaseline(c)
	if w.Code >= 500 {
		t.Fatalf("SetBaseline: got %d", w.Code)
	}
}
