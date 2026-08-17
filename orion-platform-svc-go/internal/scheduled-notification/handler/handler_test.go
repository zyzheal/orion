package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/scheduled-notification/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/scheduled-notification/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeScheduled_notificationService{})
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
type fakeScheduled_notificationService struct{}

func (f *fakeScheduled_notificationService) Count(ctx context.Context, tenantID string) (int, error) {
	return 0, nil
}

func (f *fakeScheduled_notificationService) Create(ctx context.Context, tenantID, userID string, req *models.CreateScheduleRequest) (*models.ScheduledNotification, error) {
	return &models.ScheduledNotification{}, nil
}

func (f *fakeScheduled_notificationService) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	return false, nil
}

func (f *fakeScheduled_notificationService) Execute(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeScheduled_notificationService) Get(ctx context.Context, tenantID, id string) (*models.ScheduledNotification, error) {
	return &models.ScheduledNotification{}, nil
}

func (f *fakeScheduled_notificationService) GetLogs(ctx context.Context, tenantID, id string) ([]models.ExecutionLog, error) {
	return []models.ExecutionLog{}, nil
}

func (f *fakeScheduled_notificationService) List(ctx context.Context, tenantID string, filter *models.ListFilter, page, pageSize int) ([]models.ScheduledNotification, int, error) {
	return []models.ScheduledNotification{}, 0, nil
}

func (f *fakeScheduled_notificationService) Pause(ctx context.Context, tenantID, id string) (*models.ScheduledNotification, error) {
	return &models.ScheduledNotification{}, nil
}

func (f *fakeScheduled_notificationService) Resume(ctx context.Context, tenantID, id string) (*models.ScheduledNotification, error) {
	return &models.ScheduledNotification{}, nil
}

func (f *fakeScheduled_notificationService) Update(ctx context.Context, tenantID, id string, req *models.UpdateScheduleRequest) (*models.ScheduledNotification, error) {
	return &models.ScheduledNotification{}, nil
}

var _ service.ServiceInterface = (*fakeScheduled_notificationService)(nil)
=======
type fakescheduled_notificationService struct{}

func (f *fakescheduled_notificationService) Count(ctx context.Context, tenantID string) ((int, error)) {
	return 0, nil
}

func (f *fakescheduled_notificationService) Create(ctx context.Context, tenantID, userID string, req *models.CreateScheduleRequest) ((*models.ScheduledNotification, error)) {
	return &models.ScheduledNotification{}, nil
}

func (f *fakescheduled_notificationService) Delete(ctx context.Context, tenantID, id string) ((bool, error)) {
	return false, nil
}

func (f *fakescheduled_notificationService) Execute(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakescheduled_notificationService) Get(ctx context.Context, tenantID, id string) ((*models.ScheduledNotification, error)) {
	return &models.ScheduledNotification{}, nil
}

func (f *fakescheduled_notificationService) GetLogs(ctx context.Context, tenantID, id string) (([]models.ExecutionLog, error)) {
	return []models.ExecutionLog{}, nil
}

func (f *fakescheduled_notificationService) List(ctx context.Context, tenantID string, filter *models.ListFilter, page, pageSize int) (([]models.ScheduledNotification, int, error)) {
	return []models.ScheduledNotification{}, 0, nil
}

func (f *fakescheduled_notificationService) Pause(ctx context.Context, tenantID, id string) ((*models.ScheduledNotification, error)) {
	return &models.ScheduledNotification{}, nil
}

func (f *fakescheduled_notificationService) Resume(ctx context.Context, tenantID, id string) ((*models.ScheduledNotification, error)) {
	return &models.ScheduledNotification{}, nil
}

func (f *fakescheduled_notificationService) Update(ctx context.Context, tenantID, id string, req *models.UpdateScheduleRequest) ((*models.ScheduledNotification, error)) {
	return &models.ScheduledNotification{}, nil
}

var _ service.ServiceInterface = (*fakescheduled_notificationService)(nil)
>>>>>>> Stashed changes


func TestHandler_SCHEDULED_NOTI_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SCHEDULED_NO_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_SCHEDULED_NO_getUserID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getUserID(c)
	if w.Code >= 500 {
		t.Fatalf("getUserID: got %d", w.Code)
	}
}
func TestHandler_SCHEDULED_NO_getPagination(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getPagination(c)
	if w.Code >= 500 {
		t.Fatalf("getPagination: got %d", w.Code)
	}
}
func TestHandler_SCHEDULED_NO_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_SCHEDULED_NO_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_SCHEDULED_NO_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_SCHEDULED_NO_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_SCHEDULED_NO_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_SCHEDULED_NO_Count(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Count(c)
	if w.Code >= 500 {
		t.Fatalf("Count: got %d", w.Code)
	}
}
func TestHandler_SCHEDULED_NO_Execute(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Execute(c)
	if w.Code >= 500 {
		t.Fatalf("Execute: got %d", w.Code)
	}
}
func TestHandler_SCHEDULED_NO_Pause(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Pause(c)
	if w.Code >= 500 {
		t.Fatalf("Pause: got %d", w.Code)
	}
}
func TestHandler_SCHEDULED_NO_Resume(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Resume(c)
	if w.Code >= 500 {
		t.Fatalf("Resume: got %d", w.Code)
	}
}
func TestHandler_SCHEDULED_NO_GetLogs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetLogs(c)
	if w.Code >= 500 {
		t.Fatalf("GetLogs: got %d", w.Code)
	}
}
