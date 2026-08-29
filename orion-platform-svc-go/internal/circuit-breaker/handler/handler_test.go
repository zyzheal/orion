package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/circuit-breaker/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/circuit-breaker/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeCircuit_breakerService{})
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

type fakeCircuit_breakerService struct{}

func (f *fakeCircuit_breakerService) Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.CircuitBreaker, error) {
	return &models.CircuitBreaker{}, nil
}

func (f *fakeCircuit_breakerService) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeCircuit_breakerService) Evaluate(ctx context.Context, id, tenantID string) (*models.StateResponse, error) {
	return &models.StateResponse{}, nil
}

func (f *fakeCircuit_breakerService) Get(ctx context.Context, id, tenantID string) (*models.CircuitBreaker, error) {
	return &models.CircuitBreaker{}, nil
}

func (f *fakeCircuit_breakerService) GetRecentEvents(ctx context.Context, id, tenantID string, limit int) ([]models.CircuitEvent, error) {
	return []models.CircuitEvent{}, nil
}

func (f *fakeCircuit_breakerService) List(ctx context.Context, tenantID string) ([]models.CircuitBreaker, error) {
	return []models.CircuitBreaker{}, nil
}

func (f *fakeCircuit_breakerService) ListOpen(ctx context.Context, tenantID string) ([]models.CircuitBreaker, error) {
	return []models.CircuitBreaker{}, nil
}

func (f *fakeCircuit_breakerService) RecordFailure(ctx context.Context, id, tenantID string, errMsg string) (*models.CircuitBreaker, error) {
	return &models.CircuitBreaker{}, nil
}

func (f *fakeCircuit_breakerService) RecordSuccess(ctx context.Context, id, tenantID string, responseTimeMs int) (*models.CircuitBreaker, error) {
	return &models.CircuitBreaker{}, nil
}

func (f *fakeCircuit_breakerService) Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.CircuitBreaker, error) {
	return &models.CircuitBreaker{}, nil
}

var _ service.ServiceInterface = (*fakeCircuit_breakerService)(nil)

func TestCIRCUIT_BREAKER_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCIRCUIT_BREAKER_Handler_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}

func TestCIRCUIT_BREAKER_Handler_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}

func TestCIRCUIT_BREAKER_Handler_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}

func TestCIRCUIT_BREAKER_Handler_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}

func TestCIRCUIT_BREAKER_Handler_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}

func TestCIRCUIT_BREAKER_Handler_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}

func TestCIRCUIT_BREAKER_Handler_RecordSuccess(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RecordSuccess(c)
	if w.Code >= 500 {
		t.Fatalf("RecordSuccess: got %d", w.Code)
	}
}

func TestCIRCUIT_BREAKER_Handler_RecordFailure(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().RecordFailure(c)
	if w.Code >= 500 {
		t.Fatalf("RecordFailure: got %d", w.Code)
	}
}

func TestCIRCUIT_BREAKER_Handler_GetState(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetState(c)
	if w.Code >= 500 {
		t.Fatalf("GetState: got %d", w.Code)
	}
}

func TestCIRCUIT_BREAKER_Handler_GetEvents(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetEvents(c)
	if w.Code >= 500 {
		t.Fatalf("GetEvents: got %d", w.Code)
	}
}

func TestCIRCUIT_BREAKER_Handler_ListOpen(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListOpen(c)
	if w.Code >= 500 {
		t.Fatalf("ListOpen: got %d", w.Code)
	}
}
