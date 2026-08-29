package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/artifact/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/artifact/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeHandlerService{})
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

type fakeHandlerService struct{}

func (f *fakeHandlerService) AddTags(ctx context.Context, tenantID, id string, tags []string) error {
	return nil
}

func (f *fakeHandlerService) Create(ctx context.Context, tenantID string, req models.CreateArtifactRequest) (*models.Artifact, error) {
	return &models.Artifact{}, nil
}

func (f *fakeHandlerService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeHandlerService) Deprecate(ctx context.Context, tenantID, id string) (*models.Artifact, error) {
	return &models.Artifact{}, nil
}

func (f *fakeHandlerService) Download(ctx context.Context, tenantID, id string, req models.DownloadArtifactRequest) (*models.Artifact, error) {
	return &models.Artifact{}, nil
}

func (f *fakeHandlerService) Get(ctx context.Context, tenantID, id string) (*models.Artifact, error) {
	return &models.Artifact{}, nil
}

func (f *fakeHandlerService) GetCurrentStage(ctx context.Context, tenantID, id string) (*string, error) {
	stage := "initial"
	return &stage, nil
}

func (f *fakeHandlerService) GetDownloadHistory(ctx context.Context, tenantID, id string) ([]models.ArtifactDownload, error) {
	return []models.ArtifactDownload{}, nil
}

func (f *fakeHandlerService) GetNamespaces(ctx context.Context, tenantID string) ([]models.NamespaceStat, error) {
	return []models.NamespaceStat{}, nil
}

func (f *fakeHandlerService) GetPromotionHistory(ctx context.Context, tenantID, id string) ([]models.ArtifactPromotion, error) {
	return []models.ArtifactPromotion{}, nil
}

func (f *fakeHandlerService) GetStats(ctx context.Context, tenantID string) (*models.ArtifactStats, error) {
	return &models.ArtifactStats{}, nil
}

func (f *fakeHandlerService) GetTags(ctx context.Context, tenantID, id string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeHandlerService) GetTypeStats(ctx context.Context, tenantID string) ([]models.ArtifactTypeStat, error) {
	return []models.ArtifactTypeStat{}, nil
}

func (f *fakeHandlerService) List(ctx context.Context, tenantID string, q models.ListArtifactsQuery) (*models.ArtifactListResponse, error) {
	return &models.ArtifactListResponse{}, nil
}

func (f *fakeHandlerService) Promote(ctx context.Context, tenantID, id string, req models.PromoteArtifactRequest) (*models.ArtifactPromotion, error) {
	return &models.ArtifactPromotion{}, nil
}

func (f *fakeHandlerService) Quarantine(ctx context.Context, tenantID, id string, req models.QuarantineArtifactRequest) (*models.Artifact, error) {
	return &models.Artifact{}, nil
}

func (f *fakeHandlerService) RemoveTags(ctx context.Context, tenantID, id string, tags []string) error {
	return nil
}

func (f *fakeHandlerService) Search(ctx context.Context, tenantID string, query string, limit, offset int) ([]models.Artifact, error) {
	return []models.Artifact{}, nil
}

func (f *fakeHandlerService) Update(ctx context.Context, tenantID, id string, req models.UpdateArtifactRequest) (*models.Artifact, error) {
	return &models.Artifact{}, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)

func TestARTIFACT_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestARTIFACT_Handler_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_AddTags(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().AddTags(c)
	if w.Code >= 500 {
		t.Fatalf("AddTags: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_RemoveTags(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RemoveTags(c)
	if w.Code >= 500 {
		t.Fatalf("RemoveTags: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_GetTags(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetTags(c)
	if w.Code >= 500 {
		t.Fatalf("GetTags: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_Download(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Download(c)
	if w.Code >= 500 {
		t.Fatalf("Download: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_GetDownloadHistory(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetDownloadHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetDownloadHistory: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_Search(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Search(c)
	if w.Code >= 500 {
		t.Fatalf("Search: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_Promote(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Promote(c)
	if w.Code >= 500 {
		t.Fatalf("Promote: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_GetStage(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetStage(c)
	if w.Code >= 500 {
		t.Fatalf("GetStage: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_GetPromotionHistory(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetPromotionHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetPromotionHistory: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_Deprecate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Deprecate(c)
	if w.Code >= 500 {
		t.Fatalf("Deprecate: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_Quarantine(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Quarantine(c)
	if w.Code >= 500 {
		t.Fatalf("Quarantine: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_GetStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_GetTypeStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetTypeStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetTypeStats: got %d", w.Code)
	}
}

func TestARTIFACT_Handler_GetNamespaces(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetNamespaces(c)
	if w.Code >= 500 {
		t.Fatalf("GetNamespaces: got %d", w.Code)
	}
}
