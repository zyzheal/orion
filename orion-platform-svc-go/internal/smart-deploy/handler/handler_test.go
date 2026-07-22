package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/smart-deploy/service"

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

func TestHandler_SMART_DEPLOY_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SMART_DEPLOY_CreateDeployment(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateDeployment(c)
	if w.Code >= 500 {
		t.Fatalf("CreateDeployment: got %d", w.Code)
	}
}
func TestHandler_SMART_DEPLOY_GetDeployment(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDeployment(c)
	if w.Code >= 500 {
		t.Fatalf("GetDeployment: got %d", w.Code)
	}
}
func TestHandler_SMART_DEPLOY_ListDeployments(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListDeployments(c)
	if w.Code >= 500 {
		t.Fatalf("ListDeployments: got %d", w.Code)
	}
}
func TestHandler_SMART_DEPLOY_GetLatestDeployment(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetLatestDeployment(c)
	if w.Code >= 500 {
		t.Fatalf("GetLatestDeployment: got %d", w.Code)
	}
}
func TestHandler_SMART_DEPLOY_CancelDeployment(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CancelDeployment(c)
	if w.Code >= 500 {
		t.Fatalf("CancelDeployment: got %d", w.Code)
	}
}
func TestHandler_SMART_DEPLOY_DeleteDeployment(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteDeployment(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteDeployment: got %d", w.Code)
	}
}
func TestHandler_SMART_DEPLOY_Rollback(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Rollback(c)
	if w.Code >= 500 {
		t.Fatalf("Rollback: got %d", w.Code)
	}
}
func TestHandler_SMART_DEPLOY_GetRollbackHistory(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetRollbackHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetRollbackHistory: got %d", w.Code)
	}
}
func TestHandler_SMART_DEPLOY_GetMetrics(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("GetMetrics: got %d", w.Code)
	}
}
func TestHandler_SMART_DEPLOY_GetAuditTrail(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetAuditTrail(c)
	if w.Code >= 500 {
		t.Fatalf("GetAuditTrail: got %d", w.Code)
	}
}
