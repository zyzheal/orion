package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/ai/cost/models"
	"orion/platform-svc-go/internal/ai/cost/service"

	"github.com/gin-gonic/gin"
)

type fakeCostService struct{}

func (f *fakeCostService) ListCostRecords(ctx context.Context, tenantID string, f2 models.CostFilter) ([]models.CostRecord, error) {
	return []models.CostRecord{}, nil
}
func (f *fakeCostService) GetCostSummary(ctx context.Context, tenantID string, f2 models.CostFilter) (*models.CostSummary, error) {
	return &models.CostSummary{}, nil
}
func (f *fakeCostService) GetCostRecord(ctx context.Context, tenantID string, id string) (*models.CostRecord, error) {
	return &models.CostRecord{ID: id}, nil
}
func (f *fakeCostService) DeleteCostRecord(ctx context.Context, tenantID string, id string) error { return nil }
func (f *fakeCostService) RecordCost(ctx context.Context, tenantID string, record *models.CostRecord) (*models.CostRecord, error) { return record, nil }
func (f *fakeCostService) GetDailyCosts(ctx context.Context, tenantID string, days int) ([]models.DailyCost, error) { return nil, nil }
func (f *fakeCostService) GetTopModelsByCost(ctx context.Context, tenantID string, limit int) ([]models.ModelCost, error) { return nil, nil }

var _ service.ServiceInterface = (*fakeCostService)(nil)

func newHandler() *Handler {
	return NewHandler(&service.Service{})
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

func TestAI_COST_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestAI_COST_Handler_ListRecords(t *testing.T) {
	h := NewHandler(&fakeCostService{})
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	h.ListRecords(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ListRecords: got %d", w.Code)
	}
}

func TestAI_COST_Handler_GetSummary(t *testing.T) {
	h := NewHandler(&fakeCostService{})
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	h.GetSummary(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetSummary: got %d", w.Code)
	}
}

func TestAI_COST_Handler_GetRecord(t *testing.T) {
	h := NewHandler(&fakeCostService{})
	c, w := makeCtx(http.MethodGet, "/", nil, map[string]string{"id": "rec-1"})
	h.GetRecord(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetRecord: got %d", w.Code)
	}
}

func TestAI_COST_Handler_RecordCost(t *testing.T) {
	h := NewHandler(&fakeCostService{})
	c, w := makeCtx(http.MethodPost, "/", models.CostRecord{ModelID: "gpt-4"}, nil)
	h.RecordCost(c)
	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Fatalf("RecordCost: got %d", w.Code)
	}
}
