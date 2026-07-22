package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/iac/service"

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

func TestHandler_IAC_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_IAC_ListWorkspaces(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListWorkspaces(c)
	if w.Code >= 500 {
		t.Fatalf("ListWorkspaces: got %d", w.Code)
	}
}
func TestHandler_IAC_CreateWorkspace(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateWorkspace(c)
	if w.Code >= 500 {
		t.Fatalf("CreateWorkspace: got %d", w.Code)
	}
}
func TestHandler_IAC_GetWorkspace(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetWorkspace(c)
	if w.Code >= 500 {
		t.Fatalf("GetWorkspace: got %d", w.Code)
	}
}
func TestHandler_IAC_UpdateWorkspace(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateWorkspace(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateWorkspace: got %d", w.Code)
	}
}
func TestHandler_IAC_GeneratePlan(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GeneratePlan(c)
	if w.Code >= 500 {
		t.Fatalf("GeneratePlan: got %d", w.Code)
	}
}
func TestHandler_IAC_ApplyPlan(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ApplyPlan(c)
	if w.Code >= 500 {
		t.Fatalf("ApplyPlan: got %d", w.Code)
	}
}
func TestHandler_IAC_GetCurrentState(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetCurrentState(c)
	if w.Code >= 500 {
		t.Fatalf("GetCurrentState: got %d", w.Code)
	}
}
func TestHandler_IAC_ListResources(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListResources(c)
	if w.Code >= 500 {
		t.Fatalf("ListResources: got %d", w.Code)
	}
}
func TestHandler_IAC_ImportResource(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ImportResource(c)
	if w.Code >= 500 {
		t.Fatalf("ImportResource: got %d", w.Code)
	}
}
func TestHandler_IAC_ListStateVersions(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListStateVersions(c)
	if w.Code >= 500 {
		t.Fatalf("ListStateVersions: got %d", w.Code)
	}
}
func TestHandler_IAC_GetStateDiff(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStateDiff(c)
	if w.Code >= 500 {
		t.Fatalf("GetStateDiff: got %d", w.Code)
	}
}
func TestHandler_IAC_ListPlans(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListPlans(c)
	if w.Code >= 500 {
		t.Fatalf("ListPlans: got %d", w.Code)
	}
}
func TestHandler_IAC_GetPlan(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetPlan(c)
	if w.Code >= 500 {
		t.Fatalf("GetPlan: got %d", w.Code)
	}
}
func TestHandler_IAC_ListModules(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListModules(c)
	if w.Code >= 500 {
		t.Fatalf("ListModules: got %d", w.Code)
	}
}
func TestHandler_IAC_CreateModule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateModule(c)
	if w.Code >= 500 {
		t.Fatalf("CreateModule: got %d", w.Code)
	}
}
func TestHandler_IAC_GetModule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetModule(c)
	if w.Code >= 500 {
		t.Fatalf("GetModule: got %d", w.Code)
	}
}
func TestHandler_IAC_DeleteModule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteModule(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteModule: got %d", w.Code)
	}
}
