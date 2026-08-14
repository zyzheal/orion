package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/artifact-ops/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/artifact-ops/models"
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

func (f *fakeHandlerService) Cleanup(ctx context.Context, tenantID string) (map[string]any, error) {
	return map[string]any{}, nil
}

func (f *fakeHandlerService) DefineRetentionPolicy(ctx context.Context, tenantID string, req models.DefineRetentionPolicyRequest) (*models.RetentionPolicy, error) {
	return &models.RetentionPolicy{}, nil
}

func (f *fakeHandlerService) DeletePolicy(ctx context.Context, tenantID, policyID string) (error) {
	return nil
}

func (f *fakeHandlerService) DetectMalicious(ctx context.Context, tenantID string, req models.DetectMaliciousRequest) (*models.DetectMaliciousResult, error) {
	return &models.DetectMaliciousResult{}, nil
}

func (f *fakeHandlerService) EvaluateRetention(ctx context.Context, tenantID string, req models.EvaluateRetentionRequest) (*models.EvaluateRetentionResult, error) {
	return &models.EvaluateRetentionResult{}, nil
}

func (f *fakeHandlerService) GetArtifactScanReports(ctx context.Context, tenantID, artifactID string) ([]models.ScanReport, error) {
	return []models.ScanReport{}, nil
}

func (f *fakeHandlerService) GetArtifactStats(ctx context.Context, tenantID, artifactID string) (*models.ArtifactStats, error) {
	return &models.ArtifactStats{}, nil
}

func (f *fakeHandlerService) GetOperationHistory(ctx context.Context, tenantID, artifactID string, limit, offset int) ([]models.ArtifactOperation, error) {
	return []models.ArtifactOperation{}, nil
}

func (f *fakeHandlerService) GetRetentionReport(ctx context.Context, tenantID string, req models.RetentionReportRequest) (*models.RetentionReport, error) {
	return &models.RetentionReport{}, nil
}

func (f *fakeHandlerService) GetScanReport(ctx context.Context, tenantID, scanID string) (*models.ScanReport, error) {
	return &models.ScanReport{}, nil
}

func (f *fakeHandlerService) ListPolicies(ctx context.Context, tenantID string) ([]models.RetentionPolicy, error) {
	return []models.RetentionPolicy{}, nil
}

func (f *fakeHandlerService) ScanArtifact(ctx context.Context, tenantID, artifactID string, req models.ScanArtifactRequest) (*models.ArtifactScan, error) {
	return &models.ArtifactScan{}, nil
}

func (f *fakeHandlerService) TrackOperation(ctx context.Context, tenantID, actorID string, req models.TrackOperationRequest) (*models.ArtifactOperation, error) {
	return &models.ArtifactOperation{}, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)


func TestARTIFACT_OPS_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestARTIFACT_OPS_Handler_TrackOperation(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().TrackOperation(c)
	if w.Code >= 500 {
		t.Fatalf("TrackOperation: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_GetOperationHistory(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetOperationHistory(c)
	if w.Code >= 500 {
		t.Fatalf("GetOperationHistory: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_GetArtifactStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetArtifactStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetArtifactStats: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_Cleanup(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Cleanup(c)
	if w.Code >= 500 {
		t.Fatalf("Cleanup: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_ScanArtifact(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ScanArtifact(c)
	if w.Code >= 500 {
		t.Fatalf("ScanArtifact: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_GetScanReport(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetScanReport(c)
	if w.Code >= 500 {
		t.Fatalf("GetScanReport: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_GetArtifactScanReports(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetArtifactScanReports(c)
	if w.Code >= 500 {
		t.Fatalf("GetArtifactScanReports: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_DetectMalicious(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DetectMalicious(c)
	if w.Code >= 500 {
		t.Fatalf("DetectMalicious: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_DefineRetentionPolicy(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DefineRetentionPolicy(c)
	if w.Code >= 500 {
		t.Fatalf("DefineRetentionPolicy: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_EvaluateRetention(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().EvaluateRetention(c)
	if w.Code >= 500 {
		t.Fatalf("EvaluateRetention: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_GetRetentionReport(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetRetentionReport(c)
	if w.Code >= 500 {
		t.Fatalf("GetRetentionReport: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_ListPolicies(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListPolicies(c)
	if w.Code >= 500 {
		t.Fatalf("ListPolicies: got %d", w.Code)
	}
}

func TestARTIFACT_OPS_Handler_DeletePolicy(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeletePolicy(c)
	if w.Code >= 500 {
		t.Fatalf("DeletePolicy: got %d", w.Code)
	}
}
