package handler

import (
	"orion/platform-svc-go/internal/apm/models"
	"context"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/apm/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&fakeApmService{})
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
type fakeApmService struct{}

func (f *fakeApmService) GetSlowTraces(ctx context.Context, tenantID string, q *models.SlowTracesQuery) (*models.SlowTracesResponse, error) {
	return &models.SlowTracesResponse{}, nil
}

func (f *fakeApmService) GetServiceTopology(ctx context.Context, tenantID string, q *models.TopologyQuery) (*models.TopologyResponse, error) {
	return &models.TopologyResponse{}, nil
}

func (f *fakeApmService) GetSlowQueries(ctx context.Context, tenantID string, q *models.SlowQueriesQuery) (*models.SlowQueriesResponse, error) {
	return &models.SlowQueriesResponse{}, nil
}

func (f *fakeApmService) Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.ApmEntry, error) {
	return &models.ApmEntry{}, nil
}

func (f *fakeApmService) Get(ctx context.Context, id, tenantID string) (*models.ApmEntry, error) {
	return &models.ApmEntry{}, nil
}

func (f *fakeApmService) List(ctx context.Context, tenantID string) ([]models.ApmEntry, error) {
	return []models.ApmEntry{}, nil
}

func (f *fakeApmService) Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.ApmEntry, error) {
	return &models.ApmEntry{}, nil
}

func (f *fakeApmService) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	return false, nil
}

var _ service.ServiceInterface = (*fakeApmService)(nil)


func TestAPM_Handler_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestAPM_Handler_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}

func TestAPM_Handler_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}

func TestAPM_Handler_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}

func TestAPM_Handler_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}

func TestAPM_Handler_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}

func TestAPM_Handler_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}

func TestAPM_Handler_GetSlowTraces(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetSlowTraces(c)
	if w.Code >= 500 {
		t.Fatalf("GetSlowTraces: got %d", w.Code)
	}
}

func TestAPM_Handler_GetServiceTopology(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetServiceTopology(c)
	if w.Code >= 500 {
		t.Fatalf("GetServiceTopology: got %d", w.Code)
	}
}

func TestAPM_Handler_GetSlowQueries(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/", nil, nil)
	newHandler().GetSlowQueries(c)
	if w.Code >= 500 {
		t.Fatalf("GetSlowQueries: got %d", w.Code)
	}
}
