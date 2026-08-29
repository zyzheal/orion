package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/notification-management/models"
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

func (f *fakeHandler) Create(ctx context.Context, tenantID string, req models.CreateNotificationManagementRequest) (*models.NotificationManagement, error) {
	return &models.NotificationManagement{}, nil
}

func (f *fakeHandler) Get(ctx context.Context, tenantID, id string) (*models.NotificationManagement, error) {
	return &models.NotificationManagement{}, nil
}

func (f *fakeHandler) List(ctx context.Context, tenantID string) ([]models.NotificationManagement, error) {
	return []models.NotificationManagement{}, nil
}

func (f *fakeHandler) Update(ctx context.Context, tenantID, id string, req models.UpdateNotificationManagementRequest) (*models.NotificationManagement, error) {
	return &models.NotificationManagement{}, nil
}

func (f *fakeHandler) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func TestHandler_NOTIFICATION_M_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_NOTIFICATION_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
