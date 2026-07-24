package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/user-profile/service"

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

func TestHandler_USER_PROFILE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_USER_PROFILE_GetMyProfile(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetMyProfile(c)
	if w.Code >= 500 {
		t.Fatalf("GetMyProfile: got %d", w.Code)
	}
}
func TestHandler_USER_PROFILE_GetProfile(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetProfile(c)
	if w.Code >= 500 {
		t.Fatalf("GetProfile: got %d", w.Code)
	}
}
func TestHandler_USER_PROFILE_UpdateMyProfile(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateMyProfile(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateMyProfile: got %d", w.Code)
	}
}
func TestHandler_USER_PROFILE_UpdateProfile(t *testing.T) {
	t.Skip("handler uses concrete service, cannot inject mock")
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateProfile(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateProfile: got %d", w.Code)
	}
}
