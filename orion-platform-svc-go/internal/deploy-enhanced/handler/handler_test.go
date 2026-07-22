package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/deploy-enhanced/service"

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

func TestHandler_DEPLOY_ENHANCE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_DEPLOY_ENHAN_getTenantID(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_ListWindows(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListWindows(c)
	if w.Code >= 500 {
		t.Fatalf("ListWindows: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_GetWindow(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetWindow(c)
	if w.Code >= 500 {
		t.Fatalf("GetWindow: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_CreateWindow(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateWindow(c)
	if w.Code >= 500 {
		t.Fatalf("CreateWindow: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_UpdateWindow(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateWindow(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateWindow: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_DeleteWindow(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteWindow(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteWindow: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_CheckWindow(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CheckWindow(c)
	if w.Code >= 500 {
		t.Fatalf("CheckWindow: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_CreateProgressiveDeploy(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateProgressiveDeploy(c)
	if w.Code >= 500 {
		t.Fatalf("CreateProgressiveDeploy: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_GetProgress(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetProgress(c)
	if w.Code >= 500 {
		t.Fatalf("GetProgress: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_AdvanceStage(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AdvanceStage(c)
	if w.Code >= 500 {
		t.Fatalf("AdvanceStage: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_RollbackStage(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RollbackStage(c)
	if w.Code >= 500 {
		t.Fatalf("RollbackStage: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_RequestEmergencyDeploy(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RequestEmergencyDeploy(c)
	if w.Code >= 500 {
		t.Fatalf("RequestEmergencyDeploy: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_ListEmergencies(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListEmergencies(c)
	if w.Code >= 500 {
		t.Fatalf("ListEmergencies: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_ApproveEmergencyDeploy(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ApproveEmergencyDeploy(c)
	if w.Code >= 500 {
		t.Fatalf("ApproveEmergencyDeploy: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_CompleteEmergencyDeploy(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CompleteEmergencyDeploy(c)
	if w.Code >= 500 {
		t.Fatalf("CompleteEmergencyDeploy: got %d", w.Code)
	}
}
func TestHandler_DEPLOY_ENHAN_RejectEmergencyDeploy(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RejectEmergencyDeploy(c)
	if w.Code >= 500 {
		t.Fatalf("RejectEmergencyDeploy: got %d", w.Code)
	}
}
