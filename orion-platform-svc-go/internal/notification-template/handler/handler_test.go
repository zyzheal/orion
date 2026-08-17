package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/notification-template/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/notification-template/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeNotification_templateService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

<<<<<<< Updated upstream
type fakeNotification_templateService struct{}

func (f *fakeNotification_templateService) Count(ctx context.Context, tenantID string) (int, error) {
	return 0, nil
}

func (f *fakeNotification_templateService) Create(ctx context.Context, tenantID, userID string, req *models.CreateTemplateRequest) (*models.NotificationTemplate, error) {
	return &models.NotificationTemplate{}, nil
}

func (f *fakeNotification_templateService) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	return false, nil
}

func (f *fakeNotification_templateService) Duplicate(ctx context.Context, tenantID, userID, id string) (*models.NotificationTemplate, error) {
	return &models.NotificationTemplate{}, nil
}

func (f *fakeNotification_templateService) Get(ctx context.Context, tenantID, id string) (*models.NotificationTemplate, error) {
	return &models.NotificationTemplate{}, nil
}

func (f *fakeNotification_templateService) List(ctx context.Context, tenantID string, filter models.ListFilter, page, pageSize int) ([]models.NotificationTemplate, int, int, error) {
	return []models.NotificationTemplate{}, 0, 0, nil
}

func (f *fakeNotification_templateService) Preview(ctx context.Context, tenantID, id string) (*models.RenderResult, error) {
	return &models.RenderResult{}, nil
}

func (f *fakeNotification_templateService) Render(ctx context.Context, tenantID string, req *models.RenderRequest) (*models.RenderResult, error) {
	return &models.RenderResult{}, nil
}

func (f *fakeNotification_templateService) Update(ctx context.Context, tenantID, id string, req *models.UpdateTemplateRequest) (*models.NotificationTemplate, error) {
	return &models.NotificationTemplate{}, nil
}

var _ service.ServiceInterface = (*fakeNotification_templateService)(nil)
=======
type fakenotification_templateService struct{}

func (f *fakenotification_templateService) Count(ctx context.Context, tenantID string) ((int, error)) {
	return 0, nil
}

func (f *fakenotification_templateService) Create(ctx context.Context, tenantID, userID string, req *models.CreateTemplateRequest) ((*models.NotificationTemplate, error)) {
	return &models.NotificationTemplate{}, nil
}

func (f *fakenotification_templateService) Delete(ctx context.Context, tenantID, id string) ((bool, error)) {
	return false, nil
}

func (f *fakenotification_templateService) Duplicate(ctx context.Context, tenantID, userID, id string) ((*models.NotificationTemplate, error)) {
	return &models.NotificationTemplate{}, nil
}

func (f *fakenotification_templateService) Get(ctx context.Context, tenantID, id string) ((*models.NotificationTemplate, error)) {
	return &models.NotificationTemplate{}, nil
}

func (f *fakenotification_templateService) List(ctx context.Context, tenantID string, filter models.ListFilter, page, pageSize int) (([]models.NotificationTemplate, int, int, error)) {
	return []models.NotificationTemplate{}, 0, 0, nil
}

func (f *fakenotification_templateService) Preview(ctx context.Context, tenantID, id string) ((*models.RenderResult, error)) {
	return &models.RenderResult{}, nil
}

func (f *fakenotification_templateService) Render(ctx context.Context, tenantID string, req *models.RenderRequest) ((*models.RenderResult, error)) {
	return &models.RenderResult{}, nil
}

func (f *fakenotification_templateService) Update(ctx context.Context, tenantID, id string, req *models.UpdateTemplateRequest) ((*models.NotificationTemplate, error)) {
	return &models.NotificationTemplate{}, nil
}

var _ service.ServiceInterface = (*fakenotification_templateService)(nil)
>>>>>>> Stashed changes


func TestHandler_NOTIFICATION_T_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_NOTIFICATION_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_getUserID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getUserID(c)
	if w.Code >= 500 {
		t.Fatalf("getUserID: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
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
func TestHandler_NOTIFICATION_Count(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Count(c)
	if w.Code >= 500 {
		t.Fatalf("Count: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_Render(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Render(c)
	if w.Code >= 500 {
		t.Fatalf("Render: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_Preview(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Preview(c)
	if w.Code >= 500 {
		t.Fatalf("Preview: got %d", w.Code)
	}
}
func TestHandler_NOTIFICATION_Duplicate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Duplicate(c)
	if w.Code >= 500 {
		t.Fatalf("Duplicate: got %d", w.Code)
	}
}
