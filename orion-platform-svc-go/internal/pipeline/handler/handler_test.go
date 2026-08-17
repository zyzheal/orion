package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/pipeline/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/pipeline/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakePipelineService{})
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
type fakePipelineService struct{}

func (f *fakePipelineService) BatchDelete(ctx context.Context, tenantID string, pipelineIDs []string) ([]models.BatchDeleteResult, error) {
	return []models.BatchDeleteResult{}, nil
}

func (f *fakePipelineService) BatchStart(ctx context.Context, tenantID string, pipelineIDs []string) ([]models.BatchStartResult, error) {
	return []models.BatchStartResult{}, nil
}

func (f *fakePipelineService) BatchStop(ctx context.Context, tenantID string, runIDs []string) ([]models.BatchStopResult, error) {
	return []models.BatchStopResult{}, nil
}

func (f *fakePipelineService) CreatePipeline(ctx context.Context, tenantID string, req models.CreatePipelineRequest) (*models.Pipeline, error) {
	return &models.Pipeline{}, nil
}

func (f *fakePipelineService) DeletePipeline(ctx context.Context, tenantID, id string) (bool, error) {
	return false, nil
}

func (f *fakePipelineService) GetPipeline(ctx context.Context, tenantID, id string) (*models.Pipeline, error) {
	return &models.Pipeline{}, nil
}

func (f *fakePipelineService) GetStats(ctx context.Context, tenantID, pipelineID string) (*models.PipelineStats, error) {
	return &models.PipelineStats{}, nil
}

func (f *fakePipelineService) GetVersions(ctx context.Context, tenantID, pipelineID string) ([]models.PipelineVersion, error) {
	return []models.PipelineVersion{}, nil
}

func (f *fakePipelineService) ListPipelines(ctx context.Context, tenantID string, opt models.ListPipelinesOptions) ([]models.Pipeline, int, error) {
	return []models.Pipeline{}, 0, nil
}

func (f *fakePipelineService) StartRun(ctx context.Context, tenantID, id string) (*models.PipelineRunResult, error) {
	return &models.PipelineRunResult{}, nil
}

func (f *fakePipelineService) StopRun(ctx context.Context, tenantID, runID string) error {
	return nil
}

func (f *fakePipelineService) UpdatePipeline(ctx context.Context, tenantID, id string, req models.UpdatePipelineRequest) (*models.Pipeline, error) {
	return &models.Pipeline{}, nil
}

func (f *fakePipelineService) ValidatePipeline(ctx context.Context, tenantID string, req models.CreatePipelineRequest) (*models.PipelineValidationResult, error) {
	return &models.PipelineValidationResult{}, nil
}

var _ service.ServiceInterface = (*fakePipelineService)(nil)
=======
type fakepipelineService struct{}

func (f *fakepipelineService) BatchDelete(ctx context.Context, tenantID string, pipelineIDs []string) (([]models.BatchDeleteResult, error)) {
	return []models.BatchDeleteResult{}, nil
}

func (f *fakepipelineService) BatchStart(ctx context.Context, tenantID string, pipelineIDs []string) (([]models.BatchStartResult, error)) {
	return []models.BatchStartResult{}, nil
}

func (f *fakepipelineService) BatchStop(ctx context.Context, tenantID string, runIDs []string) (([]models.BatchStopResult, error)) {
	return []models.BatchStopResult{}, nil
}

func (f *fakepipelineService) CreatePipeline(ctx context.Context, tenantID string, req models.CreatePipelineRequest) ((*models.Pipeline, error)) {
	return &models.Pipeline{}, nil
}

func (f *fakepipelineService) DeletePipeline(ctx context.Context, tenantID, id string) ((bool, error)) {
	return false, nil
}

func (f *fakepipelineService) GetPipeline(ctx context.Context, tenantID, id string) ((*models.Pipeline, error)) {
	return &models.Pipeline{}, nil
}

func (f *fakepipelineService) GetStats(ctx context.Context, tenantID, pipelineID string) ((*models.PipelineStats, error)) {
	return &models.PipelineStats{}, nil
}

func (f *fakepipelineService) GetVersions(ctx context.Context, tenantID, pipelineID string) (([]models.PipelineVersion, error)) {
	return []models.PipelineVersion{}, nil
}

func (f *fakepipelineService) ListPipelines(ctx context.Context, tenantID string, opt models.ListPipelinesOptions) (([]models.Pipeline, int, error)) {
	return []models.Pipeline{}, 0, nil
}

func (f *fakepipelineService) StartRun(ctx context.Context, tenantID, id string) ((*models.PipelineRunResult, error)) {
	return &models.PipelineRunResult{}, nil
}

func (f *fakepipelineService) StopRun(ctx context.Context, tenantID, runID string) (error) {
	return nil
}

func (f *fakepipelineService) UpdatePipeline(ctx context.Context, tenantID, id string, req models.UpdatePipelineRequest) ((*models.Pipeline, error)) {
	return &models.Pipeline{}, nil
}

func (f *fakepipelineService) ValidatePipeline(ctx context.Context, tenantID string, req models.CreatePipelineRequest) ((*models.PipelineValidationResult, error)) {
	return &models.PipelineValidationResult{}, nil
}

var _ service.ServiceInterface = (*fakepipelineService)(nil)
>>>>>>> Stashed changes


func TestHandler_PIPELINE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PIPELINE_ListPipelines(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListPipelines(c)
	if w.Code >= 500 {
		t.Fatalf("ListPipelines: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_CreatePipeline(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreatePipeline(c)
	if w.Code >= 500 {
		t.Fatalf("CreatePipeline: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_GetPipeline(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetPipeline(c)
	if w.Code >= 500 {
		t.Fatalf("GetPipeline: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_UpdatePipeline(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdatePipeline(c)
	if w.Code >= 500 {
		t.Fatalf("UpdatePipeline: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_DeletePipeline(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeletePipeline(c)
	if w.Code >= 500 {
		t.Fatalf("DeletePipeline: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_ValidatePipeline(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ValidatePipeline(c)
	if w.Code >= 500 {
		t.Fatalf("ValidatePipeline: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_StartRun(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().StartRun(c)
	if w.Code >= 500 {
		t.Fatalf("StartRun: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_StopRun(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().StopRun(c)
	if w.Code >= 500 {
		t.Fatalf("StopRun: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_BatchStart(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().BatchStart(c)
	if w.Code >= 500 {
		t.Fatalf("BatchStart: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_BatchStop(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().BatchStop(c)
	if w.Code >= 500 {
		t.Fatalf("BatchStop: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_BatchDelete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().BatchDelete(c)
	if w.Code >= 500 {
		t.Fatalf("BatchDelete: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_GetStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_GetVersions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetVersions(c)
	if w.Code >= 500 {
		t.Fatalf("GetVersions: got %d", w.Code)
	}
}
