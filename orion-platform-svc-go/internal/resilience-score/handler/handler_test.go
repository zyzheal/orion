package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"


	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/resilience-score/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeHandler{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeHandler struct{}

func (f *fakeHandler) GetGlobalScore(ctx context.Context, tenantID string) (*models.GlobalResilienceScore, error) {
	return &models.GlobalResilienceScore{}, nil
}

func (f *fakeHandler) ListServiceScores(ctx context.Context, tenantID string, q models.ListQuery) (*models.PaginatedResponse, error) {
	return &models.PaginatedResponse{}, nil
}

func (f *fakeHandler) GetServiceScore(ctx context.Context, tenantID, name string) (*models.ServiceResilienceScore, error) {
	return &models.ServiceResilienceScore{}, nil
}

func (f *fakeHandler) ListHistory(ctx context.Context, tenantID string, q models.ListQuery) (*models.PaginatedResponse, error) {
	return &models.PaginatedResponse{}, nil
}

func (f *fakeHandler) ListRecommendations(ctx context.Context, tenantID string, q models.ListQuery, priority, component string) (*models.PaginatedResponse, error) {
	return &models.PaginatedResponse{}, nil
}

func (f *fakeHandler) Assess(ctx context.Context, tenantID string, req models.AssessResilienceRequest) (any, error) {
	return nil, nil
}

func (f *fakeHandler) GetComponentScores(ctx context.Context, tenantID string) ([]models.ComponentScoreBreakdown, error) {
	return []models.ComponentScoreBreakdown{}, nil
}

func (f *fakeHandler) CreateBenchmark(ctx context.Context, tenantID string, req models.CreateBenchmarkRequest) (*models.ResilienceBenchmark, error) {
	return &models.ResilienceBenchmark{}, nil
}



func TestHandler_RESILIENCE_SCO_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_RESILIENCE_S_GetGlobalScore(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetGlobalScore(c)
	if w.Code >= 500 {
		t.Fatalf("GetGlobalScore: got %d", w.Code)
	}
}
func TestHandler_RESILIENCE_S_ListServiceScores(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListServiceScores(c)
	if w.Code >= 500 {
		t.Fatalf("ListServiceScores: got %d", w.Code)
	}
}
func TestHandler_RESILIENCE_S_GetServiceScore(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetServiceScore(c)
	if w.Code >= 500 {
		t.Fatalf("GetServiceScore: got %d", w.Code)
	}
}
func TestHandler_RESILIENCE_S_ListHistory(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListHistory(c)
	if w.Code >= 500 {
		t.Fatalf("ListHistory: got %d", w.Code)
	}
}
func TestHandler_RESILIENCE_S_ListRecommendations(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListRecommendations(c)
	if w.Code >= 500 {
		t.Fatalf("ListRecommendations: got %d", w.Code)
	}
}
func TestHandler_RESILIENCE_S_Assess(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Assess(c)
	if w.Code >= 500 {
		t.Fatalf("Assess: got %d", w.Code)
	}
}
func TestHandler_RESILIENCE_S_GetComponentScores(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetComponentScores(c)
	if w.Code >= 500 {
		t.Fatalf("GetComponentScores: got %d", w.Code)
	}
}
func TestHandler_RESILIENCE_S_CreateBenchmark(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateBenchmark(c)
	if w.Code >= 500 {
		t.Fatalf("CreateBenchmark: got %d", w.Code)
	}
}
