package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/build/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/build/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeBuildService{})
}

func makeCtx(method string, path string, body interface{}, params map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	buf := new(bytes.Buffer)
	if body != nil {
		json.NewEncoder(buf).Encode(body)
	}
	c.Request = httptest.NewRequest(method, path, buf)
	if params != nil {
		c.Params = gin.Params{}
		for k, v := range params {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	return c, w
}

<<<<<<< Updated upstream
type fakeBuildService struct{}

func (f *fakeBuildService) CancelBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	return &models.Build{}, nil
}

func (f *fakeBuildService) CreateBuild(ctx context.Context, tenantID string, req models.CreateBuildRequest) (*models.Build, error) {
	return &models.Build{}, nil
}

func (f *fakeBuildService) CreateEnvironment(ctx context.Context, tenantID string, req models.CreateEnvironmentRequest) (*models.BuildEnvironment, error) {
	return &models.BuildEnvironment{}, nil
}

func (f *fakeBuildService) DeleteBuild(ctx context.Context, tenantID, id string) (bool, error) {
	return false, nil
}

func (f *fakeBuildService) DeleteEnvironment(ctx context.Context, tenantID, id string) (bool, error) {
	return false, nil
}

func (f *fakeBuildService) GetBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	return &models.Build{}, nil
}

func (f *fakeBuildService) GetBuildByPipelineRun(ctx context.Context, tenantID, pipelineRunID string) (*models.Build, error) {
	return &models.Build{}, nil
}

func (f *fakeBuildService) GetBuildStats(ctx context.Context, tenantID string) (*models.BuildStats, error) {
	return &models.BuildStats{}, nil
}

func (f *fakeBuildService) GetEnvironment(ctx context.Context, tenantID, id string) (*models.BuildEnvironment, error) {
	return &models.BuildEnvironment{}, nil
}

func (f *fakeBuildService) ListBuilds(ctx context.Context, tenantID string, opt models.ListBuildsOptions) ([]models.Build, int, error) {
	return []models.Build{}, 0, nil
}

func (f *fakeBuildService) ListEnvironments(ctx context.Context, tenantID string) ([]models.BuildEnvironment, error) {
	return []models.BuildEnvironment{}, nil
}

func (f *fakeBuildService) RetryBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	return &models.Build{}, nil
}

func (f *fakeBuildService) StartBuild(ctx context.Context, tenantID, id string) (*models.Build, error) {
	return &models.Build{}, nil
}

func (f *fakeBuildService) UpdateEnvironment(ctx context.Context, tenantID, id string, req models.UpdateEnvironmentRequest) (*models.BuildEnvironment, error) {
	return &models.BuildEnvironment{}, nil
}

var _ service.ServiceInterface = (*fakeBuildService)(nil)
=======
type fakebuildService struct{}

func (f *fakebuildService) CancelBuild(ctx context.Context, tenantID, id string) ((*models.Build, error)) {
	return &models.Build{}, nil
}

func (f *fakebuildService) CreateBuild(ctx context.Context, tenantID string, req models.CreateBuildRequest) ((*models.Build, error)) {
	return &models.Build{}, nil
}

func (f *fakebuildService) CreateEnvironment(ctx context.Context, tenantID string, req models.CreateEnvironmentRequest) ((*models.BuildEnvironment, error)) {
	return &models.BuildEnvironment{}, nil
}

func (f *fakebuildService) DeleteBuild(ctx context.Context, tenantID, id string) ((bool, error)) {
	return false, nil
}

func (f *fakebuildService) DeleteEnvironment(ctx context.Context, tenantID, id string) ((bool, error)) {
	return false, nil
}

func (f *fakebuildService) GetBuild(ctx context.Context, tenantID, id string) ((*models.Build, error)) {
	return &models.Build{}, nil
}

func (f *fakebuildService) GetBuildByPipelineRun(ctx context.Context, tenantID, pipelineRunID string) ((*models.Build, error)) {
	return &models.Build{}, nil
}

func (f *fakebuildService) GetBuildStats(ctx context.Context, tenantID string) ((*models.BuildStats, error)) {
	return &models.BuildStats{}, nil
}

func (f *fakebuildService) GetEnvironment(ctx context.Context, tenantID, id string) ((*models.BuildEnvironment, error)) {
	return &models.BuildEnvironment{}, nil
}

func (f *fakebuildService) ListBuilds(ctx context.Context, tenantID string, opt models.ListBuildsOptions) (([]models.Build, int, error)) {
	return []models.Build{}, 0, nil
}

func (f *fakebuildService) ListEnvironments(ctx context.Context, tenantID string) (([]models.BuildEnvironment, error)) {
	return []models.BuildEnvironment{}, nil
}

func (f *fakebuildService) RetryBuild(ctx context.Context, tenantID, id string) ((*models.Build, error)) {
	return &models.Build{}, nil
}

func (f *fakebuildService) StartBuild(ctx context.Context, tenantID, id string) ((*models.Build, error)) {
	return &models.Build{}, nil
}

func (f *fakebuildService) UpdateEnvironment(ctx context.Context, tenantID, id string, req models.UpdateEnvironmentRequest) ((*models.BuildEnvironment, error)) {
	return &models.BuildEnvironment{}, nil
}

var _ service.ServiceInterface = (*fakebuildService)(nil)
>>>>>>> Stashed changes


func TestBUILD_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestBUILD_Handler_ListEnvironments(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListEnvironments(c)
	if w.Code >= 500 {
		t.Fatalf("ListEnvironments: got %d", w.Code)
	}
}

func TestBUILD_Handler_CreateEnvironment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateEnvironment(c)
	if w.Code >= 500 {
		t.Fatalf("CreateEnvironment: got %d", w.Code)
	}
}

func TestBUILD_Handler_GetEnvironment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetEnvironment(c)
	if w.Code >= 500 {
		t.Fatalf("GetEnvironment: got %d", w.Code)
	}
}

func TestBUILD_Handler_UpdateEnvironment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateEnvironment(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateEnvironment: got %d", w.Code)
	}
}

func TestBUILD_Handler_DeleteEnvironment(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteEnvironment(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteEnvironment: got %d", w.Code)
	}
}

func TestBUILD_Handler_ListBuilds(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListBuilds(c)
	if w.Code >= 500 {
		t.Fatalf("ListBuilds: got %d", w.Code)
	}
}

func TestBUILD_Handler_CreateBuild(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateBuild(c)
	if w.Code >= 500 {
		t.Fatalf("CreateBuild: got %d", w.Code)
	}
}

func TestBUILD_Handler_GetBuild(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetBuild(c)
	if w.Code >= 500 {
		t.Fatalf("GetBuild: got %d", w.Code)
	}
}

func TestBUILD_Handler_StartBuild(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().StartBuild(c)
	if w.Code >= 500 {
		t.Fatalf("StartBuild: got %d", w.Code)
	}
}

func TestBUILD_Handler_CancelBuild(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CancelBuild(c)
	if w.Code >= 500 {
		t.Fatalf("CancelBuild: got %d", w.Code)
	}
}

func TestBUILD_Handler_RetryBuild(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RetryBuild(c)
	if w.Code >= 500 {
		t.Fatalf("RetryBuild: got %d", w.Code)
	}
}

func TestBUILD_Handler_DeleteBuild(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteBuild(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteBuild: got %d", w.Code)
	}
}

func TestBUILD_Handler_GetStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
