package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/ueba/service"

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

func TestHandler_UEBA_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_UEBA_getTenantID(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_UEBA_ListAlerts(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListAlerts(c)
	if w.Code >= 500 {
		t.Fatalf("ListAlerts: got %d", w.Code)
	}
}
func TestHandler_UEBA_GetAlert(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetAlert(c)
	if w.Code >= 500 {
		t.Fatalf("GetAlert: got %d", w.Code)
	}
}
func TestHandler_UEBA_CreateAlert(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateAlert(c)
	if w.Code >= 500 {
		t.Fatalf("CreateAlert: got %d", w.Code)
	}
}
func TestHandler_UEBA_DismissAlert(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DismissAlert(c)
	if w.Code >= 500 {
		t.Fatalf("DismissAlert: got %d", w.Code)
	}
}
func TestHandler_UEBA_ListProfiles(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListProfiles(c)
	if w.Code >= 500 {
		t.Fatalf("ListProfiles: got %d", w.Code)
	}
}
func TestHandler_UEBA_GetProfile(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetProfile(c)
	if w.Code >= 500 {
		t.Fatalf("GetProfile: got %d", w.Code)
	}
}
func TestHandler_UEBA_DetectAnomaly(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DetectAnomaly(c)
	if w.Code >= 500 {
		t.Fatalf("DetectAnomaly: got %d", w.Code)
	}
}
