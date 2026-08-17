package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/canary-traffic/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/canary-traffic/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeCanary_trafficService{})
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
type fakeCanary_trafficService struct{}

func (f *fakeCanary_trafficService) AdjustWeight(ctx context.Context, id, tenantID string, canaryWeight int) (*models.CanaryTraffic, error) {
	return &models.CanaryTraffic{}, nil
}

func (f *fakeCanary_trafficService) Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.CanaryTraffic, error) {
	return &models.CanaryTraffic{}, nil
}

func (f *fakeCanary_trafficService) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	return false, nil
}

func (f *fakeCanary_trafficService) Get(ctx context.Context, id, tenantID string) (*models.CanaryTraffic, error) {
	return &models.CanaryTraffic{}, nil
}

func (f *fakeCanary_trafficService) GetTrafficSplit(ctx context.Context, id, tenantID string) (*models.TrafficSplit, error) {
	return &models.TrafficSplit{}, nil
}

func (f *fakeCanary_trafficService) List(ctx context.Context, tenantID string) ([]models.CanaryTraffic, error) {
	return []models.CanaryTraffic{}, nil
}

func (f *fakeCanary_trafficService) Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.CanaryTraffic, error) {
	return &models.CanaryTraffic{}, nil
}

var _ service.ServiceInterface = (*fakeCanary_trafficService)(nil)
=======
type fakecanary_trafficService struct{}

func (f *fakecanary_trafficService) AdjustWeight(ctx context.Context, id, tenantID string, canaryWeight int) ((*models.CanaryTraffic, error)) {
	return &models.CanaryTraffic{}, nil
}

func (f *fakecanary_trafficService) Create(ctx context.Context, req *models.CreateRequest, tenantID string) ((*models.CanaryTraffic, error)) {
	return &models.CanaryTraffic{}, nil
}

func (f *fakecanary_trafficService) Delete(ctx context.Context, id, tenantID string) ((bool, error)) {
	return false, nil
}

func (f *fakecanary_trafficService) Get(ctx context.Context, id, tenantID string) ((*models.CanaryTraffic, error)) {
	return &models.CanaryTraffic{}, nil
}

func (f *fakecanary_trafficService) GetTrafficSplit(ctx context.Context, id, tenantID string) ((*models.TrafficSplit, error)) {
	return &models.TrafficSplit{}, nil
}

func (f *fakecanary_trafficService) List(ctx context.Context, tenantID string) (([]models.CanaryTraffic, error)) {
	return []models.CanaryTraffic{}, nil
}

func (f *fakecanary_trafficService) Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) ((*models.CanaryTraffic, error)) {
	return &models.CanaryTraffic{}, nil
}

var _ service.ServiceInterface = (*fakecanary_trafficService)(nil)
>>>>>>> Stashed changes


func TestCANARY_TRAFFIC_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestCANARY_TRAFFIC_Handler_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}

func TestCANARY_TRAFFIC_Handler_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}

func TestCANARY_TRAFFIC_Handler_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}

func TestCANARY_TRAFFIC_Handler_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}

func TestCANARY_TRAFFIC_Handler_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}

func TestCANARY_TRAFFIC_Handler_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}

func TestCANARY_TRAFFIC_Handler_AdjustWeight(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().AdjustWeight(c)
	if w.Code >= 500 {
		t.Fatalf("AdjustWeight: got %d", w.Code)
	}
}

func TestCANARY_TRAFFIC_Handler_GetTrafficSplit(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetTrafficSplit(c)
	if w.Code >= 500 {
		t.Fatalf("GetTrafficSplit: got %d", w.Code)
	}
}
