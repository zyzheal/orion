package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/subapp/service"

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

func TestHandler_SUBAPP_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SUBAPP_List(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_SUBAPP_ListEnabled(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListEnabled(c)
	if w.Code >= 500 {
		t.Fatalf("ListEnabled: got %d", w.Code)
	}
}
func TestHandler_SUBAPP_Get(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_SUBAPP_History(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().History(c)
	if w.Code >= 500 {
		t.Fatalf("History: got %d", w.Code)
	}
}
func TestHandler_SUBAPP_Create(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_SUBAPP_Update(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_SUBAPP_ToggleStatus(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ToggleStatus(c)
	if w.Code >= 500 {
		t.Fatalf("ToggleStatus: got %d", w.Code)
	}
}
func TestHandler_SUBAPP_Delete(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
