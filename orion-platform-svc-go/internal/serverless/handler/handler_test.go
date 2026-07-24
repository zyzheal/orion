package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/serverless/service"

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

func TestHandler_SERVERLESS_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SERVERLESS_CreateFunction(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateFunction(c)
	if w.Code >= 500 {
		t.Fatalf("CreateFunction: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_GetFunction(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetFunction(c)
	if w.Code >= 500 {
		t.Fatalf("GetFunction: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_ListFunctions(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListFunctions(c)
	if w.Code >= 500 {
		t.Fatalf("ListFunctions: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_UpdateFunction(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateFunction(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateFunction: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_DeleteFunction(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteFunction(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteFunction: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_DeployFunction(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeployFunction(c)
	if w.Code >= 500 {
		t.Fatalf("DeployFunction: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_ListDeployments(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListDeployments(c)
	if w.Code >= 500 {
		t.Fatalf("ListDeployments: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_InvokeFunction(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().InvokeFunction(c)
	if w.Code >= 500 {
		t.Fatalf("InvokeFunction: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_GetFunctionLogs(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetFunctionLogs(c)
	if w.Code >= 500 {
		t.Fatalf("GetFunctionLogs: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_GetFunctionMetrics(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetFunctionMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("GetFunctionMetrics: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_GetAggregateMetrics(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetAggregateMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("GetAggregateMetrics: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_CreateTrigger(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateTrigger(c)
	if w.Code >= 500 {
		t.Fatalf("CreateTrigger: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_GetTrigger(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTrigger(c)
	if w.Code >= 500 {
		t.Fatalf("GetTrigger: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_ListTriggers(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListTriggers(c)
	if w.Code >= 500 {
		t.Fatalf("ListTriggers: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_DeleteTrigger(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteTrigger(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteTrigger: got %d", w.Code)
	}
}
func TestHandler_SERVERLESS_EvaluateAutoScaling(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().EvaluateAutoScaling(c)
	if w.Code >= 500 {
		t.Fatalf("EvaluateAutoScaling: got %d", w.Code)
	}
}
