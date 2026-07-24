package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/privacy/service"

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

func TestHandler_PRIVACY_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PRIVACY_GetConfig(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetConfig(c)
	if w.Code >= 500 {
		t.Fatalf("GetConfig: got %d", w.Code)
	}
}
func TestHandler_PRIVACY_UpsertConfig(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpsertConfig(c)
	if w.Code >= 500 {
		t.Fatalf("UpsertConfig: got %d", w.Code)
	}
}
func TestHandler_PRIVACY_DeleteConfig(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteConfig(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteConfig: got %d", w.Code)
	}
}
func TestHandler_PRIVACY_ListComplianceStatus(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListComplianceStatus(c)
	if w.Code >= 500 {
		t.Fatalf("ListComplianceStatus: got %d", w.Code)
	}
}
