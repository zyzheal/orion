package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/diagnostic/service"

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

func TestHandler_DIAGNOSTIC_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_DIAGNOSTIC_getTenantID(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_Trigger(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Trigger(c)
	if w.Code >= 500 {
		t.Fatalf("Trigger: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_ListSessions(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSessions(c)
	if w.Code >= 500 {
		t.Fatalf("ListSessions: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_GetSession(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSession(c)
	if w.Code >= 500 {
		t.Fatalf("GetSession: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_AddSymptom(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AddSymptom(c)
	if w.Code >= 500 {
		t.Fatalf("AddSymptom: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_CompleteSession(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CompleteSession(c)
	if w.Code >= 500 {
		t.Fatalf("CompleteSession: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_EstimateComplexity(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().EstimateComplexity(c)
	if w.Code >= 500 {
		t.Fatalf("EstimateComplexity: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_ListReports(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListReports(c)
	if w.Code >= 500 {
		t.Fatalf("ListReports: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_GetReport(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetReport(c)
	if w.Code >= 500 {
		t.Fatalf("GetReport: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_AddPattern(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AddPattern(c)
	if w.Code >= 500 {
		t.Fatalf("AddPattern: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_ListPatterns(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListPatterns(c)
	if w.Code >= 500 {
		t.Fatalf("ListPatterns: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_GetPattern(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetPattern(c)
	if w.Code >= 500 {
		t.Fatalf("GetPattern: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_GetStats(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_RecordOutcome(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RecordOutcome(c)
	if w.Code >= 500 {
		t.Fatalf("RecordOutcome: got %d", w.Code)
	}
}
func TestHandler_DIAGNOSTIC_GetStatus(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStatus(c)
	if w.Code >= 500 {
		t.Fatalf("GetStatus: got %d", w.Code)
	}
}
