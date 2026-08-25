package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/alert-breaker/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/alert-breaker/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeAlert_breakerService{})
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

type fakeAlert_breakerService struct{}

func (f *fakeAlert_breakerService) Create(ctx context.Context, tenantID string, req *models.CreateAlertBreakerRequest) (*models.AlertBreaker, error) {
	return &models.AlertBreaker{}, nil
}

func (f *fakeAlert_breakerService) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	return false, nil
}

func (f *fakeAlert_breakerService) Get(ctx context.Context, tenantID, id string) (*models.AlertBreaker, error) {
	return &models.AlertBreaker{}, nil
}

func (f *fakeAlert_breakerService) List(ctx context.Context, tenantID string) ([]models.AlertBreaker, int, error) {
	return []models.AlertBreaker{}, 0, nil
}

func (f *fakeAlert_breakerService) Update(ctx context.Context, tenantID, id string, req *models.UpdateAlertBreakerRequest) (*models.AlertBreaker, error) {
	return &models.AlertBreaker{}, nil
}

var _ service.ServiceInterface = (*fakeAlert_breakerService)(nil)


func TestALERT_BREAKER_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestALERT_BREAKER_Handler_ListAlertBreakers(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListAlertBreakers(c)
	if w.Code >= 500 {
		t.Fatalf("ListAlertBreakers: got %d", w.Code)
	}
}

func TestALERT_BREAKER_Handler_GetAlertBreaker(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetAlertBreaker(c)
	if w.Code >= 500 {
		t.Fatalf("GetAlertBreaker: got %d", w.Code)
	}
}

func TestALERT_BREAKER_Handler_CreateAlertBreaker(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateAlertBreaker(c)
	if w.Code >= 500 {
		t.Fatalf("CreateAlertBreaker: got %d", w.Code)
	}
}

func TestALERT_BREAKER_Handler_UpdateAlertBreaker(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().UpdateAlertBreaker(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateAlertBreaker: got %d", w.Code)
	}
}

func TestALERT_BREAKER_Handler_DeleteAlertBreaker(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteAlertBreaker(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteAlertBreaker: got %d", w.Code)
	}
}
