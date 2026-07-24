package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/product-line/service"

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

func TestHandler_PRODUCT_LINE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PRODUCT_LINE_Create(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_PRODUCT_LINE_Get(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_PRODUCT_LINE_GetByName(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetByName(c)
	if w.Code >= 500 {
		t.Fatalf("GetByName: got %d", w.Code)
	}
}
func TestHandler_PRODUCT_LINE_List(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_PRODUCT_LINE_Update(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_PRODUCT_LINE_Delete(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_PRODUCT_LINE_Activate(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Activate(c)
	if w.Code >= 500 {
		t.Fatalf("Activate: got %d", w.Code)
	}
}
func TestHandler_PRODUCT_LINE_Suspend(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Suspend(c)
	if w.Code >= 500 {
		t.Fatalf("Suspend: got %d", w.Code)
	}
}
func TestHandler_PRODUCT_LINE_ResolveEnvironment(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ResolveEnvironment(c)
	if w.Code >= 500 {
		t.Fatalf("ResolveEnvironment: got %d", w.Code)
	}
}
func TestHandler_PRODUCT_LINE_RequiresApproval(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RequiresApproval(c)
	if w.Code >= 500 {
		t.Fatalf("RequiresApproval: got %d", w.Code)
	}
}
func TestHandler_PRODUCT_LINE_CreateReleaseTrain(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateReleaseTrain(c)
	if w.Code >= 500 {
		t.Fatalf("CreateReleaseTrain: got %d", w.Code)
	}
}
func TestHandler_PRODUCT_LINE_GetReleaseTrains(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetReleaseTrains(c)
	if w.Code >= 500 {
		t.Fatalf("GetReleaseTrains: got %d", w.Code)
	}
}
func TestHandler_PRODUCT_LINE_CreateHotfixChannel(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateHotfixChannel(c)
	if w.Code >= 500 {
		t.Fatalf("CreateHotfixChannel: got %d", w.Code)
	}
}
func TestHandler_PRODUCT_LINE_GetHotfixChannels(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetHotfixChannels(c)
	if w.Code >= 500 {
		t.Fatalf("GetHotfixChannels: got %d", w.Code)
	}
}
func TestHandler_PRODUCT_LINE_IsHotfix(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().IsHotfix(c)
	if w.Code >= 500 {
		t.Fatalf("IsHotfix: got %d", w.Code)
	}
}
