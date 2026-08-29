package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/runbook/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/runbook/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeRunbookService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeRunbookService struct{}

func (f *fakeRunbookService) CompleteExecution(ctx context.Context, tenantID, executionID string, success bool) error {
	return nil
}

func (f *fakeRunbookService) Create(ctx context.Context, tenantID string, req models.CreateRunbookRequest) (*models.Runbook, error) {
	return &models.Runbook{}, nil
}

func (f *fakeRunbookService) CreateExecution(ctx context.Context, tenantID, runbookID string, req models.CreateRunbookExecutionRequest) (*models.RunbookExecution, error) {
	return &models.RunbookExecution{}, nil
}

func (f *fakeRunbookService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeRunbookService) Get(ctx context.Context, tenantID, id string) (*models.Runbook, error) {
	return &models.Runbook{}, nil
}

func (f *fakeRunbookService) List(ctx context.Context, tenantID string, q models.ListQuery) ([]models.Runbook, int, error) {
	return []models.Runbook{}, 0, nil
}

func (f *fakeRunbookService) ListExecutions(ctx context.Context, tenantID, runbookID string) ([]models.RunbookExecution, error) {
	return []models.RunbookExecution{}, nil
}

func (f *fakeRunbookService) Update(ctx context.Context, tenantID, id string, req models.UpdateRunbookRequest) (*models.Runbook, error) {
	return &models.Runbook{}, nil
}

var _ service.ServiceInterface = (*fakeRunbookService)(nil)

func TestHandler_RUNBOOK_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_RUNBOOK_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_RUNBOOK_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_RUNBOOK_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_RUNBOOK_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_RUNBOOK_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_RUNBOOK_Execute(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Execute(c)
	if w.Code >= 500 {
		t.Fatalf("Execute: got %d", w.Code)
	}
}
func TestHandler_RUNBOOK_ListExecutions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListExecutions(c)
	if w.Code >= 500 {
		t.Fatalf("ListExecutions: got %d", w.Code)
	}
}
