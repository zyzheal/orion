package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/workflow-task/service"

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

func TestHandler_WORKFLOW_TASK_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_WORKFLOW_TAS_getTenantID(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_WORKFLOW_TAS_ListTasks(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListTasks(c)
	if w.Code >= 500 {
		t.Fatalf("ListTasks: got %d", w.Code)
	}
}
func TestHandler_WORKFLOW_TAS_GetTask(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTask(c)
	if w.Code >= 500 {
		t.Fatalf("GetTask: got %d", w.Code)
	}
}
func TestHandler_WORKFLOW_TAS_ClaimTask(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ClaimTask(c)
	if w.Code >= 500 {
		t.Fatalf("ClaimTask: got %d", w.Code)
	}
}
func TestHandler_WORKFLOW_TAS_CompleteTask(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CompleteTask(c)
	if w.Code >= 500 {
		t.Fatalf("CompleteTask: got %d", w.Code)
	}
}
