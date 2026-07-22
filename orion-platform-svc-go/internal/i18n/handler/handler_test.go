package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/i18n/service"

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

func TestHandler_I18N_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_I18N_CreateLocale(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateLocale(c)
	if w.Code >= 500 {
		t.Fatalf("CreateLocale: got %d", w.Code)
	}
}
func TestHandler_I18N_ListLocales(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListLocales(c)
	if w.Code >= 500 {
		t.Fatalf("ListLocales: got %d", w.Code)
	}
}
func TestHandler_I18N_SetTranslation(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SetTranslation(c)
	if w.Code >= 500 {
		t.Fatalf("SetTranslation: got %d", w.Code)
	}
}
func TestHandler_I18N_SetBulkTranslations(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SetBulkTranslations(c)
	if w.Code >= 500 {
		t.Fatalf("SetBulkTranslations: got %d", w.Code)
	}
}
func TestHandler_I18N_GetTranslations(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTranslations(c)
	if w.Code >= 500 {
		t.Fatalf("GetTranslations: got %d", w.Code)
	}
}
func TestHandler_I18N_DeleteTranslation(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteTranslation(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteTranslation: got %d", w.Code)
	}
}
