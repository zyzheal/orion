package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/contract/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/contract/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeContractService{})
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

type fakeContractService struct{}

func (f *fakeContractService) CreateContract(ctx context.Context, tenantID string, req *models.CreateContractRequest) (*models.Contract, error) {
	return &models.Contract{}, nil
}

func (f *fakeContractService) CreateEndpoint(ctx context.Context, tenantID string, contractID string, req *models.CreateEndpointRequest) (*models.Endpoint, error) {
	return &models.Endpoint{}, nil
}

func (f *fakeContractService) DeleteContract(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeContractService) DeleteEndpoint(ctx context.Context, tenantID, contractID, id string) error {
	return nil
}

func (f *fakeContractService) GetContract(ctx context.Context, tenantID, id string) (*models.Contract, error) {
	return &models.Contract{}, nil
}

func (f *fakeContractService) GetStats(ctx context.Context, tenantID string) (*models.ContractStats, error) {
	return &models.ContractStats{}, nil
}

func (f *fakeContractService) ListContracts(ctx context.Context, tenantID string, filter *models.ContractFilter) ([]models.Contract, error) {
	return []models.Contract{}, nil
}

func (f *fakeContractService) ListEndpoints(ctx context.Context, tenantID, contractID string) ([]models.Endpoint, error) {
	return []models.Endpoint{}, nil
}

func (f *fakeContractService) UpdateContract(ctx context.Context, tenantID, id string, req *models.UpdateContractRequest) (*models.Contract, error) {
	return &models.Contract{}, nil
}

var _ service.ServiceInterface = (*fakeContractService)(nil)


func TestCONTRACT_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCONTRACT_Handler_ListContracts(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListContracts(c)
	if w.Code >= 500 {
		t.Fatalf("ListContracts: got %d", w.Code)
	}
}

func TestCONTRACT_Handler_CreateContract(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateContract(c)
	if w.Code >= 500 {
		t.Fatalf("CreateContract: got %d", w.Code)
	}
}

func TestCONTRACT_Handler_GetContract(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetContract(c)
	if w.Code >= 500 {
		t.Fatalf("GetContract: got %d", w.Code)
	}
}

func TestCONTRACT_Handler_UpdateContract(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateContract(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateContract: got %d", w.Code)
	}
}

func TestCONTRACT_Handler_DeleteContract(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteContract(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteContract: got %d", w.Code)
	}
}

func TestCONTRACT_Handler_CreateEndpoint(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateEndpoint(c)
	if w.Code >= 500 {
		t.Fatalf("CreateEndpoint: got %d", w.Code)
	}
}

func TestCONTRACT_Handler_ListEndpoints(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListEndpoints(c)
	if w.Code >= 500 {
		t.Fatalf("ListEndpoints: got %d", w.Code)
	}
}

func TestCONTRACT_Handler_DeleteEndpoint(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteEndpoint(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteEndpoint: got %d", w.Code)
	}
}

func TestCONTRACT_Handler_GetStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
