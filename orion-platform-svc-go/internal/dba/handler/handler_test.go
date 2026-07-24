package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/dba/service"

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

func TestHandler_DBA_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_DBA_ListOrders(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListOrders(c)
	if w.Code >= 500 {
		t.Fatalf("ListOrders: got %d", w.Code)
	}
}
func TestHandler_DBA_GetOrder(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetOrder(c)
	if w.Code >= 500 {
		t.Fatalf("GetOrder: got %d", w.Code)
	}
}
func TestHandler_DBA_CreateOrder(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateOrder(c)
	if w.Code >= 500 {
		t.Fatalf("CreateOrder: got %d", w.Code)
	}
}
func TestHandler_DBA_ApproveOrder(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ApproveOrder(c)
	if w.Code >= 500 {
		t.Fatalf("ApproveOrder: got %d", w.Code)
	}
}
func TestHandler_DBA_RejectOrder(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RejectOrder(c)
	if w.Code >= 500 {
		t.Fatalf("RejectOrder: got %d", w.Code)
	}
}
func TestHandler_DBA_ExecuteOrder(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ExecuteOrder(c)
	if w.Code >= 500 {
		t.Fatalf("ExecuteOrder: got %d", w.Code)
	}
}
func TestHandler_DBA_ListDataSources(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListDataSources(c)
	if w.Code >= 500 {
		t.Fatalf("ListDataSources: got %d", w.Code)
	}
}
func TestHandler_DBA_GetDataSource(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDataSource(c)
	if w.Code >= 500 {
		t.Fatalf("GetDataSource: got %d", w.Code)
	}
}
func TestHandler_DBA_CreateDataSource(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateDataSource(c)
	if w.Code >= 500 {
		t.Fatalf("CreateDataSource: got %d", w.Code)
	}
}
func TestHandler_DBA_UpdateDataSource(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateDataSource(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateDataSource: got %d", w.Code)
	}
}
func TestHandler_DBA_DeleteDataSource(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteDataSource(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteDataSource: got %d", w.Code)
	}
}
func TestHandler_DBA_TestConnection(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().TestConnection(c)
	if w.Code >= 500 {
		t.Fatalf("TestConnection: got %d", w.Code)
	}
}
func TestHandler_DBA_ListAuditRules(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListAuditRules(c)
	if w.Code >= 500 {
		t.Fatalf("ListAuditRules: got %d", w.Code)
	}
}
func TestHandler_DBA_CreateAuditRule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateAuditRule(c)
	if w.Code >= 500 {
		t.Fatalf("CreateAuditRule: got %d", w.Code)
	}
}
func TestHandler_DBA_UpdateAuditRule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateAuditRule(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateAuditRule: got %d", w.Code)
	}
}
func TestHandler_DBA_ExecuteDirectQuery(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ExecuteDirectQuery(c)
	if w.Code >= 500 {
		t.Fatalf("ExecuteDirectQuery: got %d", w.Code)
	}
}
func TestHandler_DBA_ListQueryLogs(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListQueryLogs(c)
	if w.Code >= 500 {
		t.Fatalf("ListQueryLogs: got %d", w.Code)
	}
}
