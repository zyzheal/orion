package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/event-trigger/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/event-trigger/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeEvent_triggerService{})
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
type fakeEvent_triggerService struct{}

func (f *fakeEvent_triggerService) Count(ctx context.Context, tenantID string) (int, error) {
	return 0, nil
}

func (f *fakeEvent_triggerService) Create(ctx context.Context, tenantID, userID string, req *models.CreateTriggerRequest) (*models.EventTrigger, error) {
	return &models.EventTrigger{}, nil
}

func (f *fakeEvent_triggerService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeEvent_triggerService) GetByID(ctx context.Context, tenantID, id string) (*models.EventTrigger, error) {
	return &models.EventTrigger{}, nil
}

func (f *fakeEvent_triggerService) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) ([]models.EventTrigger, error) {
	return []models.EventTrigger{}, nil
}

func (f *fakeEvent_triggerService) Update(ctx context.Context, tenantID, id string, req *models.UpdateTriggerRequest) (*models.EventTrigger, error) {
	return &models.EventTrigger{}, nil
}

var _ service.ServiceInterface = (*fakeEvent_triggerService)(nil)
=======
type fakeevent_triggerService struct{}

func (f *fakeevent_triggerService) Count(ctx context.Context, tenantID string) ((int, error)) {
	return 0, nil
}

func (f *fakeevent_triggerService) Create(ctx context.Context, tenantID, userID string, req *models.CreateTriggerRequest) ((*models.EventTrigger, error)) {
	return &models.EventTrigger{}, nil
}

func (f *fakeevent_triggerService) Delete(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakeevent_triggerService) GetByID(ctx context.Context, tenantID, id string) ((*models.EventTrigger, error)) {
	return &models.EventTrigger{}, nil
}

func (f *fakeevent_triggerService) List(ctx context.Context, tenantID string, filter *models.ListFilter, offset, limit int) (([]models.EventTrigger, error)) {
	return []models.EventTrigger{}, nil
}

func (f *fakeevent_triggerService) Update(ctx context.Context, tenantID, id string, req *models.UpdateTriggerRequest) ((*models.EventTrigger, error)) {
	return &models.EventTrigger{}, nil
}

var _ service.ServiceInterface = (*fakeevent_triggerService)(nil)
>>>>>>> Stashed changes


func TestHandler_EVENT_TRIGGER_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_EVENT_TRIGGE_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_EVENT_TRIGGE_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_EVENT_TRIGGE_Count(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Count(c)
	if w.Code >= 500 {
		t.Fatalf("Count: got %d", w.Code)
	}
}
func TestHandler_EVENT_TRIGGE_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_EVENT_TRIGGE_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_EVENT_TRIGGE_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
