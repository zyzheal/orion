package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/vector/service"

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

func TestHandler_VECTOR_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_VECTOR_CreateStore(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateStore(c)
	if w.Code >= 500 {
		t.Fatalf("CreateStore: got %d", w.Code)
	}
}
func TestHandler_VECTOR_DeleteStore(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteStore(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteStore: got %d", w.Code)
	}
}
func TestHandler_VECTOR_DeleteVectors(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteVectors(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteVectors: got %d", w.Code)
	}
}
func TestHandler_VECTOR_GetStore(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStore(c)
	if w.Code >= 500 {
		t.Fatalf("GetStore: got %d", w.Code)
	}
}
func TestHandler_VECTOR_ListStores(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListStores(c)
	if w.Code >= 500 {
		t.Fatalf("ListStores: got %d", w.Code)
	}
}
func TestHandler_VECTOR_SearchVectors(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SearchVectors(c)
	if w.Code >= 500 {
		t.Fatalf("SearchVectors: got %d", w.Code)
	}
}
func TestHandler_VECTOR_UpsertVectors(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpsertVectors(c)
	if w.Code >= 500 {
		t.Fatalf("UpsertVectors: got %d", w.Code)
	}
}
