package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/artifact-lifecycle/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/artifact-lifecycle/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeArtifact_lifecycleService{})
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
type fakeArtifact_lifecycleService struct{}

func (f *fakeArtifact_lifecycleService) AdvanceStage(ctx context.Context, tenantID, id string, req models.AdvanceStageRequest) (*models.ArtifactLifecycle, error) {
	return &models.ArtifactLifecycle{}, nil
}

func (f *fakeArtifact_lifecycleService) Archive(ctx context.Context, tenantID, id string) (*models.ArtifactLifecycle, error) {
	return &models.ArtifactLifecycle{}, nil
}

func (f *fakeArtifact_lifecycleService) Create(ctx context.Context, tenantID string, req models.CreateArtifactLifecycleRequest) (*models.ArtifactLifecycle, error) {
	return &models.ArtifactLifecycle{}, nil
}

func (f *fakeArtifact_lifecycleService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeArtifact_lifecycleService) GetByArtifactID(ctx context.Context, tenantID, artifactID string) (*models.ArtifactLifecycle, error) {
	return &models.ArtifactLifecycle{}, nil
}

func (f *fakeArtifact_lifecycleService) GetByID(ctx context.Context, tenantID, id string) (*models.ArtifactLifecycle, error) {
	return &models.ArtifactLifecycle{}, nil
}

func (f *fakeArtifact_lifecycleService) GetStageHistory(ctx context.Context, tenantID, artifactID string) ([]models.ArtifactLifecycle, error) {
	return []models.ArtifactLifecycle{}, nil
}

func (f *fakeArtifact_lifecycleService) List(ctx context.Context, tenantID string, limit, offset int) (*models.ListLifecycleResponse, error) {
	return &models.ListLifecycleResponse{}, nil
}

var _ service.ServiceInterface = (*fakeArtifact_lifecycleService)(nil)
=======
type fakeartifact_lifecycleService struct{}

func (f *fakeartifact_lifecycleService) AdvanceStage(ctx context.Context, tenantID, id string, req models.AdvanceStageRequest) ((*models.ArtifactLifecycle, error)) {
	return &models.ArtifactLifecycle{}, nil
}

func (f *fakeartifact_lifecycleService) Archive(ctx context.Context, tenantID, id string) ((*models.ArtifactLifecycle, error)) {
	return &models.ArtifactLifecycle{}, nil
}

func (f *fakeartifact_lifecycleService) Create(ctx context.Context, tenantID string, req models.CreateArtifactLifecycleRequest) ((*models.ArtifactLifecycle, error)) {
	return &models.ArtifactLifecycle{}, nil
}

func (f *fakeartifact_lifecycleService) Delete(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakeartifact_lifecycleService) GetByArtifactID(ctx context.Context, tenantID, artifactID string) ((*models.ArtifactLifecycle, error)) {
	return &models.ArtifactLifecycle{}, nil
}

func (f *fakeartifact_lifecycleService) GetByID(ctx context.Context, tenantID, id string) ((*models.ArtifactLifecycle, error)) {
	return &models.ArtifactLifecycle{}, nil
}

func (f *fakeartifact_lifecycleService) GetStageHistory(ctx context.Context, tenantID, artifactID string) (([]models.ArtifactLifecycle, error)) {
	return []models.ArtifactLifecycle{}, nil
}

func (f *fakeartifact_lifecycleService) List(ctx context.Context, tenantID string, limit, offset int) ((*models.ListLifecycleResponse, error)) {
	return &models.ListLifecycleResponse{}, nil
}

var _ service.ServiceInterface = (*fakeartifact_lifecycleService)(nil)
>>>>>>> Stashed changes


func TestARTIFACT_LIFECYCLE_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestARTIFACT_LIFECYCLE_Handler_AdvanceStage(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().AdvanceStage(c)
	if w.Code >= 500 {
		t.Fatalf("AdvanceStage: got %d", w.Code)
	}
}

func TestARTIFACT_LIFECYCLE_Handler_ArchiveArtifact(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ArchiveArtifact(c)
	if w.Code >= 500 {
		t.Fatalf("ArchiveArtifact: got %d", w.Code)
	}
}

func TestARTIFACT_LIFECYCLE_Handler_CreateLifecycle(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateLifecycle(c)
	if w.Code >= 500 {
		t.Fatalf("CreateLifecycle: got %d", w.Code)
	}
}

func TestARTIFACT_LIFECYCLE_Handler_DeleteLifecycle(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteLifecycle(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteLifecycle: got %d", w.Code)
	}
}

func TestARTIFACT_LIFECYCLE_Handler_GetLifecycle(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetLifecycle(c)
	if w.Code >= 500 {
		t.Fatalf("GetLifecycle: got %d", w.Code)
	}
}

func TestARTIFACT_LIFECYCLE_Handler_GetStageHistory(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetStageHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetStageHistory: got %d", w.Code)
	}
}

func TestARTIFACT_LIFECYCLE_Handler_ListLifecycle(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListLifecycle(c)
	if w.Code >= 500 {
		t.Fatalf("ListLifecycle: got %d", w.Code)
	}
}
