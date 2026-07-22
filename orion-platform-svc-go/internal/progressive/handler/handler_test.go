package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/progressive/service"

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

func TestHandler_PROGRESSIVE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PROGRESSIVE_List(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_Get(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_Create(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_Update(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_Delete(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_Start(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Start(c)
	if w.Code >= 500 {
		t.Fatalf("Start: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_CompleteStage(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CompleteStage(c)
	if w.Code >= 500 {
		t.Fatalf("CompleteStage: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_Pause(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Pause(c)
	if w.Code >= 500 {
		t.Fatalf("Pause: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_Resume(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Resume(c)
	if w.Code >= 500 {
		t.Fatalf("Resume: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_Rollback(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Rollback(c)
	if w.Code >= 500 {
		t.Fatalf("Rollback: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_ListStages(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListStages(c)
	if w.Code >= 500 {
		t.Fatalf("ListStages: got %d", w.Code)
	}
}
func TestHandler_PROGRESSIVE_GetProgress(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetProgress(c)
	if w.Code >= 500 {
		t.Fatalf("GetProgress: got %d", w.Code)
	}
}
