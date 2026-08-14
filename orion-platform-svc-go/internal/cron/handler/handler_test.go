package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/cron/models"

	"github.com/gin-gonic/gin"
)

// fakeCronService is a no-op implementation of service.ServiceInterface used for tests.
type fakeCronService struct{}

func (f *fakeCronService) AddJob(ctx context.Context, tenantID string, req models.CreateCronJobRequest) (*models.CronJob, error) {
	return &models.CronJob{Name: "sample"}, nil
}
func (f *fakeCronService) Create(ctx context.Context, tenantID string, req models.CreateCronJobRequest) (*models.CronJob, error) {
	return &models.CronJob{Name: "sample"}, nil
}
func (f *fakeCronService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}
func (f *fakeCronService) DisableJob(ctx context.Context, tenantID, id string) error {
	return nil
}
func (f *fakeCronService) EnableJob(ctx context.Context, tenantID, id string) error {
	return nil
}
func (f *fakeCronService) ExecuteJob(ctx context.Context, tenantID, id string) (*models.CronJobExecution, error) {
	return &models.CronJobExecution{}, nil
}
func (f *fakeCronService) Get(ctx context.Context, tenantID, id string) (*models.CronJob, error) {
	return &models.CronJob{Name: "sample"}, nil
}
func (f *fakeCronService) GetExecutionByID(ctx context.Context, tenantID, executionID string) (*models.CronJobExecution, error) {
	return &models.CronJobExecution{}, nil
}
func (f *fakeCronService) GetExecutionHistory(ctx context.Context, tenantID, jobID string) ([]models.CronJobExecution, error) {
	return nil, nil
}
func (f *fakeCronService) GetJob(ctx context.Context, tenantID, id string) (*models.CronJob, error) {
	return &models.CronJob{Name: "sample"}, nil
}
func (f *fakeCronService) GetJobs(ctx context.Context, tenantID string) ([]models.CronJob, error) {
	return nil, nil
}
func (f *fakeCronService) GetRunningJobs() []models.CronJob {
	return nil
}
func (f *fakeCronService) GetStatus(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	return nil, nil
}
func (f *fakeCronService) List(ctx context.Context, tenantID string, limit, offset int) ([]models.CronJob, error) {
	return nil, nil
}
func (f *fakeCronService) RemoveJob(ctx context.Context, tenantID, id string) error {
	return nil
}
func (f *fakeCronService) Update(ctx context.Context, tenantID, id string, req models.UpdateCronJobRequest) (*models.CronJob, error) {
	return &models.CronJob{Name: "sample"}, nil
}
func (f *fakeCronService) UpdatePartial(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.CronJob, error) {
	return &models.CronJob{Name: "sample"}, nil
}
func (f *fakeCronService) Start() {}
func (f *fakeCronService) Stop() {}

func newHandler() *Handler {
	return NewHandler(&fakeCronService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

func TestHandler_CRON_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_CRON_Create(t *testing.T) {
	c, w := makeCtx(http.MethodPost, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_CRON_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_CRON_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_CRON_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_CRON_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_CRON_EnableJob(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	newHandler().EnableJob(c)
	if w.Code >= 500 {
		t.Fatalf("EnableJob: got %d", w.Code)
	}
}
func TestHandler_CRON_DisableJob(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	newHandler().DisableJob(c)
	if w.Code >= 500 {
		t.Fatalf("DisableJob: got %d", w.Code)
	}
}
func TestHandler_CRON_ExecuteJob(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	c.Params = gin.Params{{Key: "id", Value: "1"}}
	newHandler().ExecuteJob(c)
	if w.Code >= 500 {
		t.Fatalf("ExecuteJob: got %d", w.Code)
	}
}
func TestHandler_CRON_ListExecutions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListExecutions(c)
	if w.Code >= 500 {
		t.Fatalf("ListExecutions: got %d", w.Code)
	}
}
func TestHandler_CRON_GetExecution(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	c.Params = gin.Params{{Key: "executionId", Value: "1"}}
	newHandler().GetExecution(c)
	if w.Code >= 500 {
		t.Fatalf("GetExecution: got %d", w.Code)
	}
}
func TestHandler_CRON_RunningJobs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RunningJobs(c)
	if w.Code >= 500 {
		t.Fatalf("RunningJobs: got %d", w.Code)
	}
}
func TestHandler_CRON_Status(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Status(c)
	if w.Code >= 500 {
		t.Fatalf("Status: got %d", w.Code)
	}
}
func TestHandler_CRON_StartScheduler(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().StartScheduler(c)
	if w.Code >= 500 {
		t.Fatalf("StartScheduler: got %d", w.Code)
	}
}
func TestHandler_CRON_StopScheduler(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().StopScheduler(c)
	if w.Code >= 500 {
		t.Fatalf("StopScheduler: got %d", w.Code)
	}
}
