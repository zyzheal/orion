package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/ai/gateway/models"
	"orion/platform-svc-go/internal/ai/gateway/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&fakeAiGatewayService{})
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

type fakeAiGatewayService struct{}

func (f *fakeAiGatewayService) RecordRequest(ctx context.Context, tenantID string, req *models.GatewayRequest) (*models.GatewayResponse, error) {
	return &models.GatewayResponse{}, nil
}
func (f *fakeAiGatewayService) ProcessRequest(ctx context.Context, tenantID string, req *models.GatewayRequest) (*models.GatewayResponse, error) {
	return &models.GatewayResponse{}, nil
}
func (f *fakeAiGatewayService) GetRequest(ctx context.Context, tenantID, id string) (*models.GatewayResponse, error) {
	return &models.GatewayResponse{}, nil
}
func (f *fakeAiGatewayService) ListRequests(ctx context.Context, tenantID string, q models.ListQuery) ([]models.GatewayResponse, int, error) {
	return []models.GatewayResponse{}, 0, nil
}
func (f *fakeAiGatewayService) ListByProvider(ctx context.Context, tenantID, provider string, limit int) ([]models.GatewayResponse, int, error) {
	return []models.GatewayResponse{}, 0, nil
}
func (f *fakeAiGatewayService) ListRecent(ctx context.Context, tenantID string, n int) ([]models.GatewayResponse, int, error) {
	return []models.GatewayResponse{}, 0, nil
}
func (f *fakeAiGatewayService) GetByModel(ctx context.Context, tenantID, model string) ([]models.GatewayResponse, int, error) {
	return []models.GatewayResponse{}, 0, nil
}
func (f *fakeAiGatewayService) Chat(ctx context.Context, req *models.ChatRequest) (*models.ChatResponse, error) {
	return &models.ChatResponse{}, nil
}
func (f *fakeAiGatewayService) ListModels() []models.ProviderModel {
	return []models.ProviderModel{}
}

var _ service.ServiceInterface = (*fakeAiGatewayService)(nil)

func TestAI_GATEWAY_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestAI_GATEWAY_Handler_ProcessRequest(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ProcessRequest(c)
	if w.Code >= 500 {
		t.Fatalf("ProcessRequest: got %d", w.Code)
	}
}

func TestAI_GATEWAY_Handler_GetRequest(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetRequest(c)
	if w.Code >= 500 {
		t.Fatalf("GetRequest: got %d", w.Code)
	}
}

func TestAI_GATEWAY_Handler_ListRequests(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListRequests(c)
	if w.Code >= 500 {
		t.Fatalf("ListRequests: got %d", w.Code)
	}
}

func TestAI_GATEWAY_Handler_ListByProvider(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListByProvider(c)
	if w.Code >= 500 {
		t.Fatalf("ListByProvider: got %d", w.Code)
	}
}

func TestAI_GATEWAY_Handler_ListByModel(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListByModel(c)
	if w.Code >= 500 {
		t.Fatalf("ListByModel: got %d", w.Code)
	}
}

func TestAI_GATEWAY_Handler_ListRecent(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListRecent(c)
	if w.Code >= 500 {
		t.Fatalf("ListRecent: got %d", w.Code)
	}
}
