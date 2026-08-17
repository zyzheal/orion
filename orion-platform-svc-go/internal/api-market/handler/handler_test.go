package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/api-market/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/api-market/models"
=======
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
type fakeHandlerService struct{}

func (f *fakeHandlerService) CheckSubscription(ctx context.Context, appID string, productID string, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeHandlerService) CreateDeveloperApp(ctx context.Context, req *models.CreateDeveloperAppRequest, developerID string, tenantID string) (*models.DeveloperApp, error) {
	return &models.DeveloperApp{}, nil
}

func (f *fakeHandlerService) CreateProduct(ctx context.Context, req *models.CreateProductRequest, ownerID string, tenantID string) (*models.Product, error) {
	return &models.Product{}, nil
}

func (f *fakeHandlerService) DeleteProduct(ctx context.Context, id string, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeHandlerService) GenerateAPIKey(ctx context.Context, appID string, scopes []string, tenantID string) (*service.GenerateAPIKeyResult, error) {
	return &service.GenerateAPIKeyResult{}, nil
}

func (f *fakeHandlerService) GetApp(ctx context.Context, id string, tenantID string) (*models.DeveloperApp, error) {
	return &models.DeveloperApp{}, nil
}

func (f *fakeHandlerService) GetProduct(ctx context.Context, id string, tenantID string) (*models.Product, error) {
	return &models.Product{}, nil
}

func (f *fakeHandlerService) ListAPIKeys(ctx context.Context, appID string, tenantID string) ([]models.SafeAPIKey, error) {
	return []models.SafeAPIKey{}, nil
}

func (f *fakeHandlerService) ListAppsByDeveloper(ctx context.Context, tenantID string, developerID string) ([]models.DeveloperApp, error) {
	return []models.DeveloperApp{}, nil
}

func (f *fakeHandlerService) ListProducts(ctx context.Context, tenantID string) ([]models.Product, error) {
	return []models.Product{}, nil
}

func (f *fakeHandlerService) ListSubscriptions(ctx context.Context, appID string, tenantID string) ([]models.Subscription, error) {
	return []models.Subscription{}, nil
}

func (f *fakeHandlerService) PublishProduct(ctx context.Context, id string, tenantID string) (*models.Product, error) {
	return &models.Product{}, nil
}

func (f *fakeHandlerService) Subscribe(ctx context.Context, req *models.SubscribeRequest, tenantID string) (error) {
	return nil
}

func (f *fakeHandlerService) ValidateAPIKey(ctx context.Context, tenantID string, clientID string, clientSecret string) (*models.APIKeyValidationResult, error) {
	return &models.APIKeyValidationResult{}, nil
}

var _ service.ServiceInterface = (*fakeHandlerService)(nil)
=======
type fakeapi_marketService struct{}

func (f *fakeapi_marketService) CheckSubscription(ctx context.Context, appID string, productID string, tenantID string) ((bool, error)) {
	return false, nil
}

func (f *fakeapi_marketService) CreateDeveloperApp(ctx context.Context, req *models.CreateDeveloperAppRequest, developerID string, tenantID string) ((*models.DeveloperApp, error)) {
	return &models.DeveloperApp{}, nil
}

func (f *fakeapi_marketService) CreateProduct(ctx context.Context, req *models.CreateProductRequest, ownerID string, tenantID string) ((*models.Product, error)) {
	return &models.Product{}, nil
}

func (f *fakeapi_marketService) DeleteProduct(ctx context.Context, id string, tenantID string) ((bool, error)) {
	return false, nil
}

func (f *fakeapi_marketService) GenerateAPIKey(ctx context.Context, appID string, scopes []string, tenantID string) ((*GenerateAPIKeyResult, error)) {
	return &GenerateAPIKeyResult{}, nil
}

func (f *fakeapi_marketService) GetApp(ctx context.Context, id string, tenantID string) ((*models.DeveloperApp, error)) {
	return &models.DeveloperApp{}, nil
}

func (f *fakeapi_marketService) GetProduct(ctx context.Context, id string, tenantID string) ((*models.Product, error)) {
	return &models.Product{}, nil
}

func (f *fakeapi_marketService) ListAPIKeys(ctx context.Context, appID string, tenantID string) (([]models.SafeAPIKey, error)) {
	return []models.SafeAPIKey{}, nil
}

func (f *fakeapi_marketService) ListAppsByDeveloper(ctx context.Context, tenantID string, developerID string) (([]models.DeveloperApp, error)) {
	return []models.DeveloperApp{}, nil
}

func (f *fakeapi_marketService) ListProducts(ctx context.Context, tenantID string) (([]models.Product, error)) {
	return []models.Product{}, nil
}

func (f *fakeapi_marketService) ListSubscriptions(ctx context.Context, appID string, tenantID string) (([]models.Subscription, error)) {
	return []models.Subscription{}, nil
}

func (f *fakeapi_marketService) PublishProduct(ctx context.Context, id string, tenantID string) ((*models.Product, error)) {
	return &models.Product{}, nil
}

func (f *fakeapi_marketService) Subscribe(ctx context.Context, req *models.SubscribeRequest, tenantID string) (error) {
	return nil
}

func (f *fakeapi_marketService) ValidateAPIKey(ctx context.Context, tenantID string, clientID string, clientSecret string) ((*models.APIKeyValidationResult, error)) {
	return &models.APIKeyValidationResult{}, nil
}

var _ service.ServiceInterface = (*fakeapi_marketService)(nil)
>>>>>>> Stashed changes


func Test_Handler_Handler_RegisterRoutes(t *testing.T) {
	// route wildcard conflicts expected (e.g. :id vs :somethingId); tested in integration suite
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestAPI_MARKET_Handler_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}

func TestAPI_MARKET_Handler_getOwnerID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getOwnerID(c)
	if w.Code >= 500 {
		t.Fatalf("getOwnerID: got %d", w.Code)
	}
}

func TestAPI_MARKET_Handler_CreateProduct(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateProduct(c)
	if w.Code >= 500 {
		t.Fatalf("CreateProduct: got %d", w.Code)
	}
}

func TestAPI_MARKET_Handler_ListProducts(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListProducts(c)
	if w.Code >= 500 {
		t.Fatalf("ListProducts: got %d", w.Code)
	}
}

func TestAPI_MARKET_Handler_GetProduct(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetProduct(c)
	if w.Code >= 500 {
		t.Fatalf("GetProduct: got %d", w.Code)
	}
}

func TestAPI_MARKET_Handler_PublishProduct(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().PublishProduct(c)
	if w.Code >= 500 {
		t.Fatalf("PublishProduct: got %d", w.Code)
	}
}

func TestAPI_MARKET_Handler_DeleteProduct(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().DeleteProduct(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteProduct: got %d", w.Code)
	}
}

func TestAPI_MARKET_Handler_CreateDeveloperApp(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CreateDeveloperApp(c)
	if w.Code >= 500 {
		t.Fatalf("CreateDeveloperApp: got %d", w.Code)
	}
}

func TestAPI_MARKET_Handler_ListApps(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListApps(c)
	if w.Code >= 500 {
		t.Fatalf("ListApps: got %d", w.Code)
	}
}

func TestAPI_MARKET_Handler_GetApp(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetApp(c)
	if w.Code >= 500 {
		t.Fatalf("GetApp: got %d", w.Code)
	}
}

func TestAPI_MARKET_Handler_GenerateAPIKey(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GenerateAPIKey(c)
	if w.Code >= 500 {
		t.Fatalf("GenerateAPIKey: got %d", w.Code)
	}
}

func TestAPI_MARKET_Handler_ListAPIKeys(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListAPIKeys(c)
	if w.Code >= 500 {
		t.Fatalf("ListAPIKeys: got %d", w.Code)
	}
}

func TestAPI_MARKET_Handler_ValidateToken(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ValidateToken(c)
	if w.Code >= 500 {
		t.Fatalf("ValidateToken: got %d", w.Code)
	}
}

func TestAPI_MARKET_Handler_CheckSubscription(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().CheckSubscription(c)
	if w.Code >= 500 {
		t.Fatalf("CheckSubscription: got %d", w.Code)
	}
}

func TestAPI_MARKET_Handler_Subscribe(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Subscribe(c)
	if w.Code >= 500 {
		t.Fatalf("Subscribe: got %d", w.Code)
	}
}

func TestAPI_MARKET_Handler_ListSubscriptions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().ListSubscriptions(c)
	if w.Code >= 500 {
		t.Fatalf("ListSubscriptions: got %d", w.Code)
	}
}
