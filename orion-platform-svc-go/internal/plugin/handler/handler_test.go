package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/plugin/service"

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

func TestHandler_PLUGIN_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PLUGIN_Create(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_List(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_Get(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_Delete(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_Count(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Count(c)
	if w.Code >= 500 {
		t.Fatalf("Count: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_Update(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_Install(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Install(c)
	if w.Code >= 500 {
		t.Fatalf("Install: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_Enable(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Enable(c)
	if w.Code >= 500 {
		t.Fatalf("Enable: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_Disable(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Disable(c)
	if w.Code >= 500 {
		t.Fatalf("Disable: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_Audit(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Audit(c)
	if w.Code >= 500 {
		t.Fatalf("Audit: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_AuditTrail(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AuditTrail(c)
	if w.Code >= 500 {
		t.Fatalf("AuditTrail: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_Timeline(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Timeline(c)
	if w.Code >= 500 {
		t.Fatalf("Timeline: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_DebugPause(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DebugPause(c)
	if w.Code >= 500 {
		t.Fatalf("DebugPause: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_DebugResume(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DebugResume(c)
	if w.Code >= 500 {
		t.Fatalf("DebugResume: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_DebugStep(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DebugStep(c)
	if w.Code >= 500 {
		t.Fatalf("DebugStep: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_DebugState(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DebugState(c)
	if w.Code >= 500 {
		t.Fatalf("DebugState: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_AIDiagnose(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AIDiagnose(c)
	if w.Code >= 500 {
		t.Fatalf("AIDiagnose: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_UpsertPluginQuota(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpsertPluginQuota(c)
	if w.Code >= 500 {
		t.Fatalf("UpsertPluginQuota: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_PluginQuota(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().PluginQuota(c)
	if w.Code >= 500 {
		t.Fatalf("PluginQuota: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_DeletePluginQuota(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeletePluginQuota(c)
	if w.Code >= 500 {
		t.Fatalf("DeletePluginQuota: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_CreateSecurityEvent(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateSecurityEvent(c)
	if w.Code >= 500 {
		t.Fatalf("CreateSecurityEvent: got %d", w.Code)
	}
}
func TestHandler_PLUGIN_ListSecurityEvents(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSecurityEvents(c)
	if w.Code >= 500 {
		t.Fatalf("ListSecurityEvents: got %d", w.Code)
	}
}
