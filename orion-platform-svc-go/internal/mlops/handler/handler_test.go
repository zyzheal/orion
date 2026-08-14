package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"orion/platform-svc-go/internal/mlops/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&service.Service{})
}

func makeCtx(method string, path string, body string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	var r *http.Request
	if body != "" {
		r = httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
	} else {
		r = httptest.NewRequest(method, path, nil)
	}
	c.Request = r
	return c, w
}

func TestNewHandler(t *testing.T) {
	h := newHandler()
	if h == nil {
		t.Fatal("newHandler returned nil")
	}
}

func TestHandler_RegisterRoutes(t *testing.T) {
	h := newHandler()
	r := gin.New().Group("")
	h.RegisterRoutes(r)
	if r == nil {
		t.Fatal("routes not registered")
	}
}

func TestHandler_ListModels_NoDB(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/mlops", "")
	newHandler().ListModels(c)
	if w.Code >= 500 {
		t.Fatalf("ListModels: got %d, body: %s", w.Code, w.Body.String())
	}
}

func TestHandler_RegisterModel_InvalidBody(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/mlops", "invalid json")
	newHandler().RegisterModel(c)
	if w.Code != 400 {
		t.Fatalf("RegisterModel invalid body: got %d, want 400", w.Code)
	}
}

func TestHandler_RegisterModel_MissingName(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/mlops", `{"framework":"pytorch"}`)
	newHandler().RegisterModel(c)
	if w.Code != 400 {
		t.Fatalf("RegisterModel missing name: got %d, want 400", w.Code)
	}
}

func TestHandler_GetMetrics_NoDB(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/mlops/m1/metrics", "")
	newHandler().GetMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("GetMetrics: got %d, body: %s", w.Code, w.Body.String())
	}
}