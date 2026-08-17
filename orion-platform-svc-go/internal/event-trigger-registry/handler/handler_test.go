package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/event-trigger-registry/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/event-trigger-registry/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeEvent_trigger_registryService{})
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
type fakeEvent_trigger_registryService struct{}

func (f *fakeEvent_trigger_registryService) CreateTrigger(ctx context.Context, tenantID string, req models.CreateTriggerRequest) (*models.WorkflowTrigger, error) {
	return &models.WorkflowTrigger{}, nil
}

func (f *fakeEvent_trigger_registryService) DeleteTrigger(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeEvent_trigger_registryService) GetTrigger(ctx context.Context, tenantID, id string) (*models.WorkflowTrigger, error) {
	return &models.WorkflowTrigger{}, nil
}

func (f *fakeEvent_trigger_registryService) ListTriggers(ctx context.Context, tenantID string) ([]models.WorkflowTrigger, error) {
	return []models.WorkflowTrigger{}, nil
}

func (f *fakeEvent_trigger_registryService) UpdateTrigger(ctx context.Context, tenantID, id string, req models.CreateTriggerRequest) (*models.WorkflowTrigger, error) {
	return &models.WorkflowTrigger{}, nil
}

var _ service.ServiceInterface = (*fakeEvent_trigger_registryService)(nil)
=======
type fakeevent_trigger_registryService struct{}

func (f *fakeevent_trigger_registryService) CreateTrigger(ctx context.Context, tenantID string, req models.CreateTriggerRequest) ((*models.WorkflowTrigger, error)) {
	return &models.WorkflowTrigger{}, nil
}

func (f *fakeevent_trigger_registryService) DeleteTrigger(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakeevent_trigger_registryService) GetTrigger(ctx context.Context, tenantID, id string) ((*models.WorkflowTrigger, error)) {
	return &models.WorkflowTrigger{}, nil
}

func (f *fakeevent_trigger_registryService) ListTriggers(ctx context.Context, tenantID string) (([]models.WorkflowTrigger, error)) {
	return []models.WorkflowTrigger{}, nil
}

func (f *fakeevent_trigger_registryService) UpdateTrigger(ctx context.Context, tenantID, id string, req models.CreateTriggerRequest) ((*models.WorkflowTrigger, error)) {
	return &models.WorkflowTrigger{}, nil
}

var _ service.ServiceInterface = (*fakeevent_trigger_registryService)(nil)
>>>>>>> Stashed changes


func TestHandler_EVENT_TRIGGER__RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_EVENT_TRIGGE_ListTriggers(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListTriggers(c)
	if w.Code >= 500 {
		t.Fatalf("ListTriggers: got %d", w.Code)
	}
}
func TestHandler_EVENT_TRIGGE_GetTrigger(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTrigger(c)
	if w.Code >= 500 {
		t.Fatalf("GetTrigger: got %d", w.Code)
	}
}
func TestHandler_EVENT_TRIGGE_CreateTrigger(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateTrigger(c)
	if w.Code >= 500 {
		t.Fatalf("CreateTrigger: got %d", w.Code)
	}
}
func TestHandler_EVENT_TRIGGE_UpdateTrigger(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateTrigger(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateTrigger: got %d", w.Code)
	}
}
func TestHandler_EVENT_TRIGGE_DeleteTrigger(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteTrigger(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteTrigger: got %d", w.Code)
	}
}
