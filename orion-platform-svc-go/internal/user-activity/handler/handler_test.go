package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/user-activity/models"
	"orion/platform-svc-go/internal/user-activity/service"

	"github.com/gin-gonic/gin"
	"context"
)

func newHandler() *Handler {
	return NewHandler(&fakeHandlerService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeHandlerService struct{}

func (f *fakeHandlerService) CreateActivity(ctx context.Context, userID, action, resourceType, resourceID string, details any, ipAddress, userAgent string) (*models.UserActivity, error) {
	return &models.UserActivity{}, nil
}

func (f *fakeHandlerService) DeleteActivity(ctx context.Context, userID, activityID string) (error) {
	return nil
}

func (f *fakeHandlerService) GetActivities(ctx context.Context, userID string, page, pageSize int) (*models.ActivitiesResponse, error) {
	return &models.ActivitiesResponse{}, nil
}

func (f *fakeHandlerService) GetActivity(ctx context.Context, userID, activityID string) (*models.UserActivity, error) {
	return &models.UserActivity{}, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)


func TestHandler_USER_ACTIVITY_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_USER_ACTIVIT_GetActivities(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetActivities(c)
	if w.Code >= 500 {
		t.Fatalf("GetActivities: got %d", w.Code)
	}
}
func TestHandler_USER_ACTIVIT_GetActivity(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetActivity(c)
	if w.Code >= 500 {
		t.Fatalf("GetActivity: got %d", w.Code)
	}
}
func TestHandler_USER_ACTIVIT_DeleteActivity(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteActivity(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteActivity: got %d", w.Code)
	}
}
