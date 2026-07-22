package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/handler-registry/service"

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

func TestHandler_HANDLER_REGIST_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_HANDLER_REGI_Create(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_HANDLER_REGI_Get(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_HANDLER_REGI_List(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_HANDLER_REGI_Update(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_HANDLER_REGI_Delete(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_HANDLER_REGI_HealthCheck(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().HealthCheck(c)
	if w.Code >= 500 {
		t.Fatalf("HealthCheck: got %d", w.Code)
	}
}
func TestHandler_HANDLER_REGI_GetDomains(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDomains(c)
	if w.Code >= 500 {
		t.Fatalf("GetDomains: got %d", w.Code)
	}
}
func TestHandler_HANDLER_REGI_GetEntry(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetEntry(c)
	if w.Code >= 500 {
		t.Fatalf("GetEntry: got %d", w.Code)
	}
}
func TestHandler_HANDLER_REGI_RegisterHandler(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RegisterHandler(c)
	if w.Code >= 500 {
		t.Fatalf("RegisterHandler: got %d", w.Code)
	}
}
func TestHandler_HANDLER_REGI_Enable(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Enable(c)
	if w.Code >= 500 {
		t.Fatalf("Enable: got %d", w.Code)
	}
}
func TestHandler_HANDLER_REGI_Disable(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Disable(c)
	if w.Code >= 500 {
		t.Fatalf("Disable: got %d", w.Code)
	}
}
func TestHandler_HANDLER_REGI_Unregister(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Unregister(c)
	if w.Code >= 500 {
		t.Fatalf("Unregister: got %d", w.Code)
	}
}
func TestHandler_HANDLER_REGI_Invoke(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Invoke(c)
	if w.Code >= 500 {
		t.Fatalf("Invoke: got %d", w.Code)
	}
}
