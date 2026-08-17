package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/api-consumption/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/api-consumption/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeApi_consumptionService{})
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
type fakeApi_consumptionService struct{}

func (f *fakeApi_consumptionService) CreateConsumption(ctx context.Context, tenantID string, req *models.CreateConsumptionRequest) (*models.Consumption, error) {
	return &models.Consumption{}, nil
}

func (f *fakeApi_consumptionService) CreateLimit(ctx context.Context, tenantID string, req *models.CreateLimitRequest) (*models.Limit, error) {
	return &models.Limit{}, nil
}

func (f *fakeApi_consumptionService) DeleteLimit(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeApi_consumptionService) GetLimit(ctx context.Context, tenantID, id string) (*models.Limit, error) {
	return &models.Limit{}, nil
}

func (f *fakeApi_consumptionService) GetStats(ctx context.Context, tenantID string) (*models.ConsumptionStats, error) {
	return &models.ConsumptionStats{}, nil
}

func (f *fakeApi_consumptionService) ListConsumptions(ctx context.Context, tenantID string, filter *models.ConsumptionFilter) ([]models.Consumption, error) {
	return []models.Consumption{}, nil
}

func (f *fakeApi_consumptionService) ListLimits(ctx context.Context, tenantID string) ([]models.Limit, error) {
	return []models.Limit{}, nil
}

func (f *fakeApi_consumptionService) UpdateLimit(ctx context.Context, tenantID, id string, req *models.UpdateLimitRequest) (*models.Limit, error) {
	return &models.Limit{}, nil
}

var _ service.ServiceInterface = (*fakeApi_consumptionService)(nil)
=======
type fakeapi_consumptionService struct{}

func (f *fakeapi_consumptionService) CreateConsumption(ctx context.Context, tenantID string, req *models.CreateConsumptionRequest) ((*models.Consumption, error)) {
	return &models.Consumption{}, nil
}

func (f *fakeapi_consumptionService) CreateLimit(ctx context.Context, tenantID string, req *models.CreateLimitRequest) ((*models.Limit, error)) {
	return &models.Limit{}, nil
}

func (f *fakeapi_consumptionService) DeleteLimit(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakeapi_consumptionService) GetLimit(ctx context.Context, tenantID, id string) ((*models.Limit, error)) {
	return &models.Limit{}, nil
}

func (f *fakeapi_consumptionService) GetStats(ctx context.Context, tenantID string) ((*models.ConsumptionStats, error)) {
	return &models.ConsumptionStats{}, nil
}

func (f *fakeapi_consumptionService) ListConsumptions(ctx context.Context, tenantID string, filter *models.ConsumptionFilter) (([]models.Consumption, error)) {
	return []models.Consumption{}, nil
}

func (f *fakeapi_consumptionService) ListLimits(ctx context.Context, tenantID string) (([]models.Limit, error)) {
	return []models.Limit{}, nil
}

func (f *fakeapi_consumptionService) UpdateLimit(ctx context.Context, tenantID, id string, req *models.UpdateLimitRequest) ((*models.Limit, error)) {
	return &models.Limit{}, nil
}

var _ service.ServiceInterface = (*fakeapi_consumptionService)(nil)
>>>>>>> Stashed changes


func TestAPI_CONSUMPTION_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestAPI_CONSUMPTION_Handler_ListConsumptions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListConsumptions(c)
	if w.Code >= 500 {
		t.Fatalf("ListConsumptions: got %d", w.Code)
	}
}

func TestAPI_CONSUMPTION_Handler_CreateConsumption(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateConsumption(c)
	if w.Code >= 500 {
		t.Fatalf("CreateConsumption: got %d", w.Code)
	}
}

func TestAPI_CONSUMPTION_Handler_ListLimits(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListLimits(c)
	if w.Code >= 500 {
		t.Fatalf("ListLimits: got %d", w.Code)
	}
}

func TestAPI_CONSUMPTION_Handler_CreateLimit(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateLimit(c)
	if w.Code >= 500 {
		t.Fatalf("CreateLimit: got %d", w.Code)
	}
}

func TestAPI_CONSUMPTION_Handler_GetLimit(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetLimit(c)
	if w.Code >= 500 {
		t.Fatalf("GetLimit: got %d", w.Code)
	}
}

func TestAPI_CONSUMPTION_Handler_UpdateLimit(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateLimit(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateLimit: got %d", w.Code)
	}
}

func TestAPI_CONSUMPTION_Handler_DeleteLimit(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteLimit(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteLimit: got %d", w.Code)
	}
}

func TestAPI_CONSUMPTION_Handler_GetStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
