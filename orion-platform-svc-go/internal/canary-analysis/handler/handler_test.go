package handler

import (
	"orion/platform-svc-go/internal/canary-analysis/models"
	"context"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/canary-analysis/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&fakeCanaryAnalysisService{})
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
type fakeCanaryAnalysisService struct{}

func (f *fakeCanaryAnalysisService) ForcePromote(ctx context.Context, tenantID string, req *models.ForcePromoteRequest) (*models.Analysis, error) {
	return &models.Analysis{}, nil
}

func (f *fakeCanaryAnalysisService) ForceRollback(ctx context.Context, tenantID string, req *models.ForceRollbackRequest) (*models.Analysis, error) {
	return &models.Analysis{}, nil
}

func (f *fakeCanaryAnalysisService) RetrainModel(ctx context.Context, tenantID string, req *models.RetrainRequest) (*models.RetrainResult, error) {
	return &models.RetrainResult{}, nil
}

func (f *fakeCanaryAnalysisService) DiscoverMetrics(ctx context.Context, tenantID string, query string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeCanaryAnalysisService) GetRunMetrics(ctx context.Context, tenantID, runID string) (*models.RunMetrics, error) {
	return &models.RunMetrics{}, nil
}

func (f *fakeCanaryAnalysisService) GetMLResults(ctx context.Context, tenantID, runID string) (*models.MLResults, error) {
	return &models.MLResults{}, nil
}

func (f *fakeCanaryAnalysisService) Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.Analysis, error) {
	return &models.Analysis{}, nil
}

func (f *fakeCanaryAnalysisService) Get(ctx context.Context, id, tenantID string) (*models.Analysis, error) {
	return &models.Analysis{}, nil
}

func (f *fakeCanaryAnalysisService) List(ctx context.Context, tenantID string) ([]models.Analysis, error) {
	return []models.Analysis{}, nil
}

func (f *fakeCanaryAnalysisService) Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.Analysis, error) {
	return &models.Analysis{}, nil
}

func (f *fakeCanaryAnalysisService) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	return false, nil
}

var _ service.ServiceInterface = (*fakeCanaryAnalysisService)(nil)


func TestCANARY_ANALYSIS_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCANARY_ANALYSIS_Handler_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}

func TestCANARY_ANALYSIS_Handler_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}

func TestCANARY_ANALYSIS_Handler_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}

func TestCANARY_ANALYSIS_Handler_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}

func TestCANARY_ANALYSIS_Handler_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}

func TestCANARY_ANALYSIS_Handler_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}

func TestCANARY_ANALYSIS_Handler_ForcePromote(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ForcePromote(c)
	if w.Code >= 500 {
		t.Fatalf("ForcePromote: got %d", w.Code)
	}
}

func TestCANARY_ANALYSIS_Handler_ForceRollback(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ForceRollback(c)
	if w.Code >= 500 {
		t.Fatalf("ForceRollback: got %d", w.Code)
	}
}

func TestCANARY_ANALYSIS_Handler_RetrainModel(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RetrainModel(c)
	if w.Code >= 500 {
		t.Fatalf("RetrainModel: got %d", w.Code)
	}
}

func TestCANARY_ANALYSIS_Handler_DiscoverMetrics(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DiscoverMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("DiscoverMetrics: got %d", w.Code)
	}
}

func TestCANARY_ANALYSIS_Handler_GetRunMetrics(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetRunMetrics(c)
	if w.Code >= 500 {
		t.Fatalf("GetRunMetrics: got %d", w.Code)
	}
}

func TestCANARY_ANALYSIS_Handler_GetMLResults(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetMLResults(c)
	if w.Code >= 500 {
		t.Fatalf("GetMLResults: got %d", w.Code)
	}
}
