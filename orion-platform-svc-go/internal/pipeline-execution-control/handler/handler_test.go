package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/pipeline-execution-control/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/pipeline-execution-control/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakePipeline_execution_controlService{})
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
type fakePipeline_execution_controlService struct{}

func (f *fakePipeline_execution_controlService) Abort(ctx context.Context, runID string, req *models.AbortRequest, tenantID string) (*models.Run, error) {
	return &models.Run{}, nil
}

func (f *fakePipeline_execution_controlService) GetCheckpoints(ctx context.Context, runID string, tenantID string) ([]models.Checkpoint, int, error) {
	return []models.Checkpoint{}, 0, nil
}

func (f *fakePipeline_execution_controlService) GetPauseResumeLogs(ctx context.Context, runID string, tenantID string) ([]models.ExecutionControlLog, int, error) {
	return []models.ExecutionControlLog{}, 0, nil
}

func (f *fakePipeline_execution_controlService) Pause(ctx context.Context, runID string, req *models.PauseRequest, tenantID string) (*models.Run, error) {
	return &models.Run{}, nil
}

func (f *fakePipeline_execution_controlService) Restart(ctx context.Context, runID string, req *models.RestartRequest, tenantID string) (*models.Run, error) {
	return &models.Run{}, nil
}

func (f *fakePipeline_execution_controlService) Resume(ctx context.Context, runID string, req *models.ResumeRequest, tenantID string) (*models.Run, error) {
	return &models.Run{}, nil
}

func (f *fakePipeline_execution_controlService) Retry(ctx context.Context, runID string, req *models.RetryRequest, tenantID string) (*models.Run, error) {
	return &models.Run{}, nil
}

var _ service.ServiceInterface = (*fakePipeline_execution_controlService)(nil)
=======
type fakepipeline_execution_controlService struct{}

func (f *fakepipeline_execution_controlService) Abort(ctx context.Context, runID string, req *models.AbortRequest, tenantID string) ((*models.Run, error)) {
	return &models.Run{}, nil
}

func (f *fakepipeline_execution_controlService) GetCheckpoints(ctx context.Context, runID string, tenantID string) (([]models.Checkpoint, int, error)) {
	return []models.Checkpoint{}, 0, nil
}

func (f *fakepipeline_execution_controlService) GetPauseResumeLogs(ctx context.Context, runID string, tenantID string) (([]models.ExecutionControlLog, int, error)) {
	return []models.ExecutionControlLog{}, 0, nil
}

func (f *fakepipeline_execution_controlService) Pause(ctx context.Context, runID string, req *models.PauseRequest, tenantID string) ((*models.Run, error)) {
	return &models.Run{}, nil
}

func (f *fakepipeline_execution_controlService) Restart(ctx context.Context, runID string, req *models.RestartRequest, tenantID string) ((*models.Run, error)) {
	return &models.Run{}, nil
}

func (f *fakepipeline_execution_controlService) Resume(ctx context.Context, runID string, req *models.ResumeRequest, tenantID string) ((*models.Run, error)) {
	return &models.Run{}, nil
}

func (f *fakepipeline_execution_controlService) Retry(ctx context.Context, runID string, req *models.RetryRequest, tenantID string) ((*models.Run, error)) {
	return &models.Run{}, nil
}

var _ service.ServiceInterface = (*fakepipeline_execution_controlService)(nil)
>>>>>>> Stashed changes


func TestHandler_PIPELINE_EXECU_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PIPELINE_EXE_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_EXE_Pause(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Pause(c)
	if w.Code >= 500 {
		t.Fatalf("Pause: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_EXE_Resume(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Resume(c)
	if w.Code >= 500 {
		t.Fatalf("Resume: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_EXE_Abort(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Abort(c)
	if w.Code >= 500 {
		t.Fatalf("Abort: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_EXE_Retry(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Retry(c)
	if w.Code >= 500 {
		t.Fatalf("Retry: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_EXE_Restart(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Restart(c)
	if w.Code >= 500 {
		t.Fatalf("Restart: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_EXE_GetCheckpoints(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetCheckpoints(c)
	if w.Code >= 500 {
		t.Fatalf("GetCheckpoints: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_EXE_GetControlLogs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetControlLogs(c)
	if w.Code >= 500 {
		t.Fatalf("GetControlLogs: got %d", w.Code)
	}
}
