package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/user/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/user/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeHandler{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeHandler struct{}

func (f *fakeHandler) Create(ctx context.Context, tenantID, creatorID string, req *models.CreateUserRequest) (*service.CreateUserResponse, error) {
	return &service.CreateUserResponse{}, nil
}

func (f *fakeHandler) Authenticate(ctx context.Context, req *models.AuthenticateRequest) (*models.User, error) {
	return &models.User{}, nil
}

func (f *fakeHandler) List(ctx context.Context, tenantID string, filter *models.GetUserFilters, offset, limit int) ([]models.User, error) {
	return []models.User{}, nil
}

func (f *fakeHandler) GetByID(ctx context.Context, tenantID, id string) (*models.User, error) {
	return &models.User{}, nil
}

func (f *fakeHandler) Count(ctx context.Context, tenantID string) (int, error) {
	return 0, nil
}

func (f *fakeHandler) Update(ctx context.Context, tenantID, id string, req *models.UpdateUserRequest) (*models.User, error) {
	return &models.User{}, nil
}

func (f *fakeHandler) ChangePassword(ctx context.Context, tenantID, userID string, req *models.ChangePasswordRequest) error {
	return nil
}

func (f *fakeHandler) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}



func TestHandler_USER_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_USER_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_USER_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_USER_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_USER_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_USER_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_USER_Count(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Count(c)
	if w.Code >= 500 {
		t.Fatalf("Count: got %d", w.Code)
	}
}
func TestHandler_USER_Authenticate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Authenticate(c)
	if w.Code >= 500 {
		t.Fatalf("Authenticate: got %d", w.Code)
	}
}
func TestHandler_USER_ChangePassword(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ChangePassword(c)
	if w.Code >= 500 {
		t.Fatalf("ChangePassword: got %d", w.Code)
	}
}
