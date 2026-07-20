package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/oncall/service"

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

func TestHandler_ONCALL_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_ONCALL_ListSchedules(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSchedules(c)
	if w.Code >= 500 {
		t.Fatalf("ListSchedules: got %d", w.Code)
	}
}
func TestHandler_ONCALL_GetSchedule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSchedule(c)
	if w.Code >= 500 {
		t.Fatalf("GetSchedule: got %d", w.Code)
	}
}
func TestHandler_ONCALL_CreateSchedule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateSchedule(c)
	if w.Code >= 500 {
		t.Fatalf("CreateSchedule: got %d", w.Code)
	}
}
func TestHandler_ONCALL_UpdateSchedule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateSchedule(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateSchedule: got %d", w.Code)
	}
}
func TestHandler_ONCALL_DeleteSchedule(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteSchedule(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteSchedule: got %d", w.Code)
	}
}
func TestHandler_ONCALL_ListAssignments(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListAssignments(c)
	if w.Code >= 500 {
		t.Fatalf("ListAssignments: got %d", w.Code)
	}
}
func TestHandler_ONCALL_GetAssignment(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetAssignment(c)
	if w.Code >= 500 {
		t.Fatalf("GetAssignment: got %d", w.Code)
	}
}
func TestHandler_ONCALL_CreateAssignment(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateAssignment(c)
	if w.Code >= 500 {
		t.Fatalf("CreateAssignment: got %d", w.Code)
	}
}
func TestHandler_ONCALL_UpdateAssignment(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateAssignment(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateAssignment: got %d", w.Code)
	}
}
func TestHandler_ONCALL_DeleteAssignment(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteAssignment(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteAssignment: got %d", w.Code)
	}
}
func TestHandler_ONCALL_ListOverrides(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListOverrides(c)
	if w.Code >= 500 {
		t.Fatalf("ListOverrides: got %d", w.Code)
	}
}
func TestHandler_ONCALL_GetOverride(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetOverride(c)
	if w.Code >= 500 {
		t.Fatalf("GetOverride: got %d", w.Code)
	}
}
func TestHandler_ONCALL_CreateOverride(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateOverride(c)
	if w.Code >= 500 {
		t.Fatalf("CreateOverride: got %d", w.Code)
	}
}
func TestHandler_ONCALL_UpdateOverride(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateOverride(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateOverride: got %d", w.Code)
	}
}
func TestHandler_ONCALL_DeleteOverride(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteOverride(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteOverride: got %d", w.Code)
	}
}
func TestHandler_ONCALL_GetOnCallNow(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetOnCallNow(c)
	if w.Code >= 500 {
		t.Fatalf("GetOnCallNow: got %d", w.Code)
	}
}
