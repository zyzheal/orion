package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/risk/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/risk/models"
	"time"
)

func newHandler() *Handler {
	return NewHandler(&fakeRiskService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeRiskService struct{}

func (f *fakeRiskService) Create(ctx context.Context, tenantID string, req models.CreateRiskRequest) (*models.Risk, error) {
	return &models.Risk{}, nil
}

func (f *fakeRiskService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeRiskService) Get(ctx context.Context, tenantID, id string) (*models.Risk, error) {
	return &models.Risk{}, nil
}

func (f *fakeRiskService) List(ctx context.Context, tenantID string) ([]models.Risk, error) {
	return []models.Risk{}, nil
}

func (f *fakeRiskService) Update(ctx context.Context, tenantID, id string, req models.UpdateRiskRequest) (*models.Risk, error) {
	return &models.Risk{}, nil
}

func (f *fakeRiskService) CalculateScore(ctx context.Context, req models.RiskScoreRequest) (*models.RiskScore, error) {
	return &models.RiskScore{}, nil
}

func (f *fakeRiskService) GetRiskMatrix(ctx context.Context) (*models.RiskMatrix, error) {
	return &models.RiskMatrix{}, nil
}

func (f *fakeRiskService) GetHeatmap(ctx context.Context, tenantID string) (*models.HeatmapResponse, error) {
	return &models.HeatmapResponse{}, nil
}

func (f *fakeRiskService) CalculateWeightedScore(ctx context.Context, factors []models.RiskFactor, mitigation *models.MitigationPlan) (*models.WeightedScoreResult, error) {
	return &models.WeightedScoreResult{}, nil
}

func (f *fakeRiskService) GetRiskTrends(ctx context.Context, tenantID string, since time.Time) ([]models.RiskTrend, error) {
	return []models.RiskTrend{}, nil
}

func (f *fakeRiskService) GetCorrelatedRisks(ctx context.Context, tenantID string) ([]models.CorrelatedRiskPair, error) {
	return []models.CorrelatedRiskPair{}, nil
}

var _ service.ServiceInterface = (*fakeRiskService)(nil)

func TestHandler_RISK_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_RISK_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_RISK_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_RISK_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_RISK_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_RISK_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
