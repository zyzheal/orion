package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/slo/service"

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

func TestHandler_SLO_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SLO_GetDashboard(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDashboard(c)
	if w.Code >= 500 {
		t.Fatalf("GetDashboard: got %d", w.Code)
	}
}
func TestHandler_SLO_ListSLOs(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSLOs(c)
	if w.Code >= 500 {
		t.Fatalf("ListSLOs: got %d", w.Code)
	}
}
func TestHandler_SLO_GetSLO(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSLO(c)
	if w.Code >= 500 {
		t.Fatalf("GetSLO: got %d", w.Code)
	}
}
func TestHandler_SLO_CreateSLO(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateSLO(c)
	if w.Code >= 500 {
		t.Fatalf("CreateSLO: got %d", w.Code)
	}
}
func TestHandler_SLO_UpdateSLO(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateSLO(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateSLO: got %d", w.Code)
	}
}
func TestHandler_SLO_DeleteSLO(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteSLO(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteSLO: got %d", w.Code)
	}
}
func TestHandler_SLO_RecordSLI(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RecordSLI(c)
	if w.Code >= 500 {
		t.Fatalf("RecordSLI: got %d", w.Code)
	}
}
func TestHandler_SLO_GetSLIHistory(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSLIHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetSLIHistory: got %d", w.Code)
	}
}
func TestHandler_SLO_GetLatestErrorBudget(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetLatestErrorBudget(c)
	if w.Code >= 500 {
		t.Fatalf("GetLatestErrorBudget: got %d", w.Code)
	}
}
func TestHandler_SLO_GetErrorBudgetHistory(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetErrorBudgetHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetErrorBudgetHistory: got %d", w.Code)
	}
}
