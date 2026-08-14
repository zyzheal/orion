package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/pipeline-engine/models"
	"orion/platform-svc-go/internal/pipeline-engine/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&fakePipelineEngine{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakePipelineEngine struct{}

func (f *fakePipelineEngine) Execute(ctx context.Context, tenantID string, req models.TriggerRequest) (*models.PipelineRun, error) {
	return &models.PipelineRun{}, nil
}
func (f *fakePipelineEngine) CancelRun(ctx context.Context, tenantID, runID, triggerBy string) (*models.PipelineRun, error) {
	return &models.PipelineRun{}, nil
}
func (f *fakePipelineEngine) GetRun(ctx context.Context, tenantID, runID string) (*models.PipelineRun, error) {
	return &models.PipelineRun{}, nil
}
func (f *fakePipelineEngine) ListRuns(ctx context.Context, tenantID, pipelineID string, q models.ListRunsQuery) (*models.RunListResponse, error) {
	return &models.RunListResponse{}, nil
}
func (f *fakePipelineEngine) GetStages(ctx context.Context, tenantID, runID string) ([]models.Stage, error) {
	return []models.Stage{}, nil
}
func (f *fakePipelineEngine) GetTasks(ctx context.Context, tenantID, stageID string) ([]models.Task, error) {
	return []models.Task{}, nil
}

var _ service.EngineInterface = (*fakePipelineEngine)(nil)

func TestHandler_PIPELINE_ENGIN_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PIPELINE_ENG_TriggerRun(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().TriggerRun(c)
	if w.Code >= 500 {
		t.Fatalf("TriggerRun: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_ENG_GetRun(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetRun(c)
	if w.Code >= 500 {
		t.Fatalf("GetRun: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_ENG_ListRuns(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListRuns(c)
	if w.Code >= 500 {
		t.Fatalf("ListRuns: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_ENG_GetStages(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStages(c)
	if w.Code >= 500 {
		t.Fatalf("GetStages: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_ENG_GetTasks(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTasks(c)
	if w.Code >= 500 {
		t.Fatalf("GetTasks: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_ENG_CancelRun(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CancelRun(c)
	if w.Code >= 500 {
		t.Fatalf("CancelRun: got %d", w.Code)
	}
}
