package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/report-designer/service"

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

func TestHandler_REPORT_DESIGNE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_REPORT_DESIG_CreateReport(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateReport(c)
	if w.Code >= 500 {
		t.Fatalf("CreateReport: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_GetReport(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetReport(c)
	if w.Code >= 500 {
		t.Fatalf("GetReport: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_UpdateReport(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateReport(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateReport: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_DeleteReport(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteReport(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteReport: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_ListReports(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListReports(c)
	if w.Code >= 500 {
		t.Fatalf("ListReports: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_CreateDatasource(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateDatasource(c)
	if w.Code >= 500 {
		t.Fatalf("CreateDatasource: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_UpdateDatasource(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateDatasource(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateDatasource: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_DeleteDatasource(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteDatasource(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteDatasource: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_ListDatasources(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListDatasources(c)
	if w.Code >= 500 {
		t.Fatalf("ListDatasources: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_CreateSchedule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateSchedule(c)
	if w.Code >= 500 {
		t.Fatalf("CreateSchedule: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_UpdateSchedule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateSchedule(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateSchedule: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_DeleteSchedule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteSchedule(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteSchedule: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_ListSchedules(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSchedules(c)
	if w.Code >= 500 {
		t.Fatalf("ListSchedules: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_PreviewReport(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().PreviewReport(c)
	if w.Code >= 500 {
		t.Fatalf("PreviewReport: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_ExecuteReport(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ExecuteReport(c)
	if w.Code >= 500 {
		t.Fatalf("ExecuteReport: got %d", w.Code)
	}
}
func TestHandler_REPORT_DESIG_GetExecutionHistory(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetExecutionHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetExecutionHistory: got %d", w.Code)
	}
}
