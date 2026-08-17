package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/process-step/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/process-step/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeProcess_stepService{})
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
type fakeProcess_stepService struct{}

func (f *fakeProcess_stepService) Create(ctx context.Context, tenantID string, req models.CreateProcessStepRequest) (*models.ProcessStep, error) {
	return &models.ProcessStep{}, nil
}

func (f *fakeProcess_stepService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeProcess_stepService) Get(ctx context.Context, tenantID, id string) (*models.ProcessStep, error) {
	return &models.ProcessStep{}, nil
}

func (f *fakeProcess_stepService) List(ctx context.Context, tenantID string) ([]models.ProcessStep, error) {
	return []models.ProcessStep{}, nil
}

func (f *fakeProcess_stepService) Update(ctx context.Context, tenantID, id string, req models.UpdateProcessStepRequest) (*models.ProcessStep, error) {
	return &models.ProcessStep{}, nil
}

var _ service.ServiceInterface = (*fakeProcess_stepService)(nil)
=======
type fakeprocess_stepService struct{}

func (f *fakeprocess_stepService) Create(ctx context.Context, tenantID string, req models.CreateProcessStepRequest) ((*models.ProcessStep, error)) {
	return &models.ProcessStep{}, nil
}

func (f *fakeprocess_stepService) Delete(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakeprocess_stepService) Get(ctx context.Context, tenantID, id string) ((*models.ProcessStep, error)) {
	return &models.ProcessStep{}, nil
}

func (f *fakeprocess_stepService) List(ctx context.Context, tenantID string) (([]models.ProcessStep, error)) {
	return []models.ProcessStep{}, nil
}

func (f *fakeprocess_stepService) Update(ctx context.Context, tenantID, id string, req models.UpdateProcessStepRequest) ((*models.ProcessStep, error)) {
	return &models.ProcessStep{}, nil
}

var _ service.ServiceInterface = (*fakeprocess_stepService)(nil)
>>>>>>> Stashed changes


func TestHandler_PROCESS_STEP_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PROCESS_STEP_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_PROCESS_STEP_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_PROCESS_STEP_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_PROCESS_STEP_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_PROCESS_STEP_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
