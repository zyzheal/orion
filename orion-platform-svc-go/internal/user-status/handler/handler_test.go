package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/user-status/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/user-status/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeUser_statusService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeUser_statusService struct{}

func (f *fakeUser_statusService) GetStatus(ctx context.Context, tenantID, userID string) (*models.UserStatus, error) {
	return &models.UserStatus{}, nil
}

func (f *fakeUser_statusService) ListByStatus(ctx context.Context, tenantID string, status string) ([]models.UserStatus, error) {
	return []models.UserStatus{}, nil
}

func (f *fakeUser_statusService) SetStatus(ctx context.Context, tenantID, userID string, req models.SetStatusRequest) (*models.UserStatus, error) {
	return &models.UserStatus{}, nil
}

var _ service.ServiceInterface = (*fakeUser_statusService)(nil)


func TestHandler_USER_STATUS_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_USER_STATUS_GetMyStatus(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetMyStatus(c)
	if w.Code >= 500 {
		t.Fatalf("GetMyStatus: got %d", w.Code)
	}
}
func TestHandler_USER_STATUS_GetStatus(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStatus(c)
	if w.Code >= 500 {
		t.Fatalf("GetStatus: got %d", w.Code)
	}
}
func TestHandler_USER_STATUS_SetMyStatus(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SetMyStatus(c)
	if w.Code >= 500 {
		t.Fatalf("SetMyStatus: got %d", w.Code)
	}
}
func TestHandler_USER_STATUS_ListOnline(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListOnline(c)
	if w.Code >= 500 {
		t.Fatalf("ListOnline: got %d", w.Code)
	}
}
