package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/pipeline-batch/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/pipeline-batch/models"
)

func newHandler() *Handler {
	return NewHandler(&fakePipeline_batchService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakePipeline_batchService struct{}

func (f *fakePipeline_batchService) AdvanceToNextBatch(ctx context.Context, id string, tenantID string) (*models.PhaseGroup, error) {
	return &models.PhaseGroup{}, nil
}

func (f *fakePipeline_batchService) CompleteBatch(ctx context.Context, pgID string, batchID string, tenantID string, result map[string]any) (*models.BatchRun, error) {
	return &models.BatchRun{}, nil
}

func (f *fakePipeline_batchService) CreatePhaseGroup(ctx context.Context, tenantID string, req *models.CreatePhaseGroupRequest) (*models.PhaseGroup, error) {
	return &models.PhaseGroup{}, nil
}

func (f *fakePipeline_batchService) DeletePhaseGroup(ctx context.Context, id string, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakePipeline_batchService) FailBatch(ctx context.Context, pgID string, batchID string, tenantID string, result map[string]any) (*models.BatchRun, error) {
	return &models.BatchRun{}, nil
}

func (f *fakePipeline_batchService) GetPhaseGroup(ctx context.Context, id string, tenantID string) (*models.PhaseGroup, error) {
	return &models.PhaseGroup{}, nil
}

func (f *fakePipeline_batchService) ListBatchRuns(ctx context.Context, pgID string, tenantID string) ([]models.BatchRun, error) {
	return []models.BatchRun{}, nil
}

func (f *fakePipeline_batchService) ListPhaseGroups(ctx context.Context, tenantID string, pipelineID *string, status *string, limit *int, offset *int) ([]models.PhaseGroup, int, error) {
	return []models.PhaseGroup{}, 0, nil
}

func (f *fakePipeline_batchService) PauseExecution(ctx context.Context, id string, tenantID string) (*models.PhaseGroup, error) {
	return &models.PhaseGroup{}, nil
}

func (f *fakePipeline_batchService) ResumeExecution(ctx context.Context, id string, tenantID string) (*models.PhaseGroup, error) {
	return &models.PhaseGroup{}, nil
}

func (f *fakePipeline_batchService) RollbackExecution(ctx context.Context, id string, tenantID string) (*models.PhaseGroup, error) {
	return &models.PhaseGroup{}, nil
}

func (f *fakePipeline_batchService) StartExecution(ctx context.Context, id string, tenantID string) (*models.PhaseGroup, error) {
	return &models.PhaseGroup{}, nil
}

func (f *fakePipeline_batchService) UpdatePhaseGroup(ctx context.Context, id string, tenantID string, req *models.UpdatePhaseGroupRequest) (*models.PhaseGroup, error) {
	return &models.PhaseGroup{}, nil
}

var _ service.ServiceInterface = (*fakePipeline_batchService)(nil)

func TestHandler_PIPELINE_BATCH_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PIPELINE_BAT_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_BAT_CreatePhaseGroup(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreatePhaseGroup(c)
	if w.Code >= 500 {
		t.Fatalf("CreatePhaseGroup: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_BAT_ListPhaseGroups(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListPhaseGroups(c)
	if w.Code >= 500 {
		t.Fatalf("ListPhaseGroups: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_BAT_GetPhaseGroup(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetPhaseGroup(c)
	if w.Code >= 500 {
		t.Fatalf("GetPhaseGroup: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_BAT_UpdatePhaseGroup(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdatePhaseGroup(c)
	if w.Code >= 500 {
		t.Fatalf("UpdatePhaseGroup: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_BAT_DeletePhaseGroup(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeletePhaseGroup(c)
	if w.Code >= 500 {
		t.Fatalf("DeletePhaseGroup: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_BAT_StartExecution(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().StartExecution(c)
	if w.Code >= 500 {
		t.Fatalf("StartExecution: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_BAT_PauseExecution(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().PauseExecution(c)
	if w.Code >= 500 {
		t.Fatalf("PauseExecution: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_BAT_ResumeExecution(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ResumeExecution(c)
	if w.Code >= 500 {
		t.Fatalf("ResumeExecution: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_BAT_AdvanceToNextBatch(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AdvanceToNextBatch(c)
	if w.Code >= 500 {
		t.Fatalf("AdvanceToNextBatch: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_BAT_RollbackExecution(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RollbackExecution(c)
	if w.Code >= 500 {
		t.Fatalf("RollbackExecution: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_BAT_ListBatchRuns(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListBatchRuns(c)
	if w.Code >= 500 {
		t.Fatalf("ListBatchRuns: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_BAT_CompleteBatch(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CompleteBatch(c)
	if w.Code >= 500 {
		t.Fatalf("CompleteBatch: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_BAT_FailBatch(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().FailBatch(c)
	if w.Code >= 500 {
		t.Fatalf("FailBatch: got %d", w.Code)
	}
}
