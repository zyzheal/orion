package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/api-key/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/api-key/models"
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

func (f *fakeHandlerService) Create(ctx context.Context, tenantID, userID string, req *models.CreateKeyRequest) (*service.CreateAPIKeyResponse, error) {
	return &service.CreateAPIKeyResponse{}, nil
}

func (f *fakeHandlerService) Delete(ctx context.Context, tenantID, userID, id string) error {
	return nil
}

func (f *fakeHandlerService) List(ctx context.Context, tenantID, userID string) ([]models.APIKey, error) {
	return []models.APIKey{}, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)

func TestAPI_KEY_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestAPI_KEY_Handler_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}

func TestAPI_KEY_Handler_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}

func TestAPI_KEY_Handler_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
