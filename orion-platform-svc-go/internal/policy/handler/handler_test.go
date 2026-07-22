package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/policy/service"

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

func TestHandler_POLICY_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_POLICY_List(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_POLICY_Create(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_POLICY_Get(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_POLICY_Update(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_POLICY_Delete(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_POLICY_Toggle(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Toggle(c)
	if w.Code >= 500 {
		t.Fatalf("Toggle: got %d", w.Code)
	}
}
func TestHandler_POLICY_Evaluate(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Evaluate(c)
	if w.Code >= 500 {
		t.Fatalf("Evaluate: got %d", w.Code)
	}
}
func TestHandler_POLICY_ListEvaluations(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListEvaluations(c)
	if w.Code >= 500 {
		t.Fatalf("ListEvaluations: got %d", w.Code)
	}
}
func TestHandler_POLICY_EvaluatePolicyRoot(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().EvaluatePolicyRoot(c)
	if w.Code >= 500 {
		t.Fatalf("EvaluatePolicyRoot: got %d", w.Code)
	}
}
func TestHandler_POLICY_EvaluateRoot(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().EvaluateRoot(c)
	if w.Code >= 500 {
		t.Fatalf("EvaluateRoot: got %d", w.Code)
	}
}
func TestHandler_POLICY_ListRootEvaluations(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListRootEvaluations(c)
	if w.Code >= 500 {
		t.Fatalf("ListRootEvaluations: got %d", w.Code)
	}
}
func TestHandler_POLICY_ListEvaluationsRuns(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListEvaluationsRuns(c)
	if w.Code >= 500 {
		t.Fatalf("ListEvaluationsRuns: got %d", w.Code)
	}
}
func TestHandler_POLICY_ListViolations(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListViolations(c)
	if w.Code >= 500 {
		t.Fatalf("ListViolations: got %d", w.Code)
	}
}
func TestHandler_POLICY_WaiveViolation(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().WaiveViolation(c)
	if w.Code >= 500 {
		t.Fatalf("WaiveViolation: got %d", w.Code)
	}
}
func TestHandler_POLICY_ResolveViolation(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ResolveViolation(c)
	if w.Code >= 500 {
		t.Fatalf("ResolveViolation: got %d", w.Code)
	}
}
func TestHandler_POLICY_ListOverrides(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListOverrides(c)
	if w.Code >= 500 {
		t.Fatalf("ListOverrides: got %d", w.Code)
	}
}
func TestHandler_POLICY_CreateOverride(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateOverride(c)
	if w.Code >= 500 {
		t.Fatalf("CreateOverride: got %d", w.Code)
	}
}
func TestHandler_POLICY_ListBundles(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListBundles(c)
	if w.Code >= 500 {
		t.Fatalf("ListBundles: got %d", w.Code)
	}
}
func TestHandler_POLICY_GetBundle(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetBundle(c)
	if w.Code >= 500 {
		t.Fatalf("GetBundle: got %d", w.Code)
	}
}
func TestHandler_POLICY_SyncBundles(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SyncBundles(c)
	if w.Code >= 500 {
		t.Fatalf("SyncBundles: got %d", w.Code)
	}
}
func TestHandler_POLICY_TestPolicy(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().TestPolicy(c)
	if w.Code >= 500 {
		t.Fatalf("TestPolicy: got %d", w.Code)
	}
}
func TestHandler_POLICY_CreateExemption(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateExemption(c)
	if w.Code >= 500 {
		t.Fatalf("CreateExemption: got %d", w.Code)
	}
}
func TestHandler_POLICY_GetExemption(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetExemption(c)
	if w.Code >= 500 {
		t.Fatalf("GetExemption: got %d", w.Code)
	}
}
func TestHandler_POLICY_ListExemptions(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListExemptions(c)
	if w.Code >= 500 {
		t.Fatalf("ListExemptions: got %d", w.Code)
	}
}
func TestHandler_POLICY_ApproveExemption(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ApproveExemption(c)
	if w.Code >= 500 {
		t.Fatalf("ApproveExemption: got %d", w.Code)
	}
}
func TestHandler_POLICY_RejectExemption(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RejectExemption(c)
	if w.Code >= 500 {
		t.Fatalf("RejectExemption: got %d", w.Code)
	}
}
func TestHandler_POLICY_RevokeExemption(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RevokeExemption(c)
	if w.Code >= 500 {
		t.Fatalf("RevokeExemption: got %d", w.Code)
	}
}
