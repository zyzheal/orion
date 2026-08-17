package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/pipeline-version/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/pipeline-version/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakePipeline_versionService{})
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
type fakePipeline_versionService struct{}

func (f *fakePipeline_versionService) AddTag(ctx context.Context, versionID string, tenantID string, tag string) (*models.PipelineVersion, error) {
	return &models.PipelineVersion{}, nil
}

func (f *fakePipeline_versionService) CreateVersion(ctx context.Context, pipelineID string, tenantID string, req *models.CreateVersionRequest) (*models.PipelineVersion, error) {
	return &models.PipelineVersion{}, nil
}

func (f *fakePipeline_versionService) DiffVersions(ctx context.Context, fromID string, toID string, tenantID string) (*models.DiffResult, error) {
	return &models.DiffResult{}, nil
}

func (f *fakePipeline_versionService) GetVersion(ctx context.Context, id string, tenantID string) (*models.PipelineVersion, error) {
	return &models.PipelineVersion{}, nil
}

func (f *fakePipeline_versionService) GetVersionByPipelineAndVersion(ctx context.Context, pipelineID string, version string, tenantID string) (*models.PipelineVersion, error) {
	return &models.PipelineVersion{}, nil
}

func (f *fakePipeline_versionService) ListVersionsByPipeline(ctx context.Context, pipelineID string, tenantID string) ([]models.PipelineVersion, int, error) {
	return []models.PipelineVersion{}, 0, nil
}

func (f *fakePipeline_versionService) RemoveTag(ctx context.Context, versionID string, tenantID string, tag string) (*models.PipelineVersion, error) {
	return &models.PipelineVersion{}, nil
}

func (f *fakePipeline_versionService) Rollback(ctx context.Context, versionID string, tenantID string) (*models.PipelineVersion, error) {
	return &models.PipelineVersion{}, nil
}

func (f *fakePipeline_versionService) SetBaseline(ctx context.Context, versionID string, tenantID string, set bool) (*models.PipelineVersion, error) {
	return &models.PipelineVersion{}, nil
}

var _ service.ServiceInterface = (*fakePipeline_versionService)(nil)
=======
type fakepipeline_versionService struct{}

func (f *fakepipeline_versionService) AddTag(ctx context.Context, versionID string, tenantID string, tag string) ((*models.PipelineVersion, error)) {
	return &models.PipelineVersion{}, nil
}

func (f *fakepipeline_versionService) CreateVersion(ctx context.Context, pipelineID string, tenantID string, req *models.CreateVersionRequest) ((*models.PipelineVersion, error)) {
	return &models.PipelineVersion{}, nil
}

func (f *fakepipeline_versionService) DiffVersions(ctx context.Context, fromID string, toID string, tenantID string) ((*models.DiffResult, error)) {
	return &models.DiffResult{}, nil
}

func (f *fakepipeline_versionService) GetVersion(ctx context.Context, id string, tenantID string) ((*models.PipelineVersion, error)) {
	return &models.PipelineVersion{}, nil
}

func (f *fakepipeline_versionService) GetVersionByPipelineAndVersion(ctx context.Context, pipelineID string, version string, tenantID string) ((*models.PipelineVersion, error)) {
	return &models.PipelineVersion{}, nil
}

func (f *fakepipeline_versionService) ListVersionsByPipeline(ctx context.Context, pipelineID string, tenantID string) (([]models.PipelineVersion, int, error)) {
	return []models.PipelineVersion{}, 0, nil
}

func (f *fakepipeline_versionService) RemoveTag(ctx context.Context, versionID string, tenantID string, tag string) ((*models.PipelineVersion, error)) {
	return &models.PipelineVersion{}, nil
}

func (f *fakepipeline_versionService) Rollback(ctx context.Context, versionID string, tenantID string) ((*models.PipelineVersion, error)) {
	return &models.PipelineVersion{}, nil
}

func (f *fakepipeline_versionService) SetBaseline(ctx context.Context, versionID string, tenantID string, set bool) ((*models.PipelineVersion, error)) {
	return &models.PipelineVersion{}, nil
}

var _ service.ServiceInterface = (*fakepipeline_versionService)(nil)
>>>>>>> Stashed changes


func TestHandler_PIPELINE_VERSI_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_PIPELINE_VER_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_VER_GetVersion(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetVersion(c)
	if w.Code >= 500 {
		t.Fatalf("GetVersion: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_VER_DiffVersions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DiffVersions(c)
	if w.Code >= 500 {
		t.Fatalf("DiffVersions: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_VER_Rollback(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Rollback(c)
	if w.Code >= 500 {
		t.Fatalf("Rollback: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_VER_AddTag(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AddTag(c)
	if w.Code >= 500 {
		t.Fatalf("AddTag: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_VER_RemoveTag(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RemoveTag(c)
	if w.Code >= 500 {
		t.Fatalf("RemoveTag: got %d", w.Code)
	}
}
func TestHandler_PIPELINE_VER_SetBaseline(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SetBaseline(c)
	if w.Code >= 500 {
		t.Fatalf("SetBaseline: got %d", w.Code)
	}
}
