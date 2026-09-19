package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/apm/models"
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

type capturingApmService struct {
	slowTraces    *models.SlowTracesQuery
	topologyQuery *models.TopologyQuery
	slowTracesErr error
	topologyErr   error
}

func (f *capturingApmService) GetSlowTraces(ctx context.Context, tenantID string, q *models.SlowTracesQuery) (*models.SlowTracesResponse, error) {
	f.slowTraces = q
	return &models.SlowTracesResponse{}, f.slowTracesErr
}

func (f *capturingApmService) GetServiceTopology(ctx context.Context, tenantID string, q *models.TopologyQuery) (*models.TopologyResponse, error) {
	f.topologyQuery = q
	return &models.TopologyResponse{}, f.topologyErr
}

func (f *capturingApmService) GetSlowQueries(ctx context.Context, tenantID string, q *models.SlowQueriesQuery) (*models.SlowQueriesResponse, error) {
	return &models.SlowQueriesResponse{}, nil
}

func (f *capturingApmService) Create(ctx context.Context, req *models.CreateRequest, tenantID string) (*models.ApmEntry, error) {
	return &models.ApmEntry{}, nil
}

func (f *capturingApmService) Get(ctx context.Context, id, tenantID string) (*models.ApmEntry, error) {
	return &models.ApmEntry{}, nil
}

func (f *capturingApmService) List(ctx context.Context, tenantID string) ([]models.ApmEntry, error) {
	return []models.ApmEntry{}, nil
}

func (f *capturingApmService) Update(ctx context.Context, id, tenantID string, req *models.UpdateRequest) (*models.ApmEntry, error) {
	return &models.ApmEntry{}, nil
}

func (f *capturingApmService) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	return false, nil
}

var _ service.ServiceInterface = (*capturingApmService)(nil)

func TestGetSlowTraces_QueryParamsReachService(t *testing.T) {
	f := &capturingApmService{}
	c, w := makeCtx(http.MethodGet, "/apm/traces/slow?service=api&start=2026-08-26T00:00:00Z&end=2026-08-26T01:00:00Z&limit=7&durationMs=250", nil, nil)
	NewHandler(f).GetSlowTraces(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	q := f.slowTraces
	if q == nil {
		t.Fatal("the service was never called")
	}
	if q.TraceDurationMs != "250" || q.Service != "api" || q.Start != "2026-08-26T00:00:00Z" || q.End != "2026-08-26T01:00:00Z" || q.Limit != 7 {
		t.Fatalf("query = %+v", q)
	}
}

func TestGetSlowTraces_ThresholdMsAliasReachesService(t *testing.T) {
	f := &capturingApmService{}
	c, w := makeCtx(http.MethodGet, "/apm/traces/slow?thresholdMs=250", nil, nil)
	NewHandler(f).GetSlowTraces(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if f.slowTraces == nil || f.slowTraces.TraceDurationMs != "250" {
		t.Fatalf("query = %+v: thresholdMs is the name the frontend sends, so it must reach the service", f.slowTraces)
	}
}

func TestGetSlowTraces_DurationMsTakesPrecedenceOverAlias(t *testing.T) {
	f := &capturingApmService{}
	c, w := makeCtx(http.MethodGet, "/apm/traces/slow?durationMs=100&thresholdMs=250", nil, nil)
	NewHandler(f).GetSlowTraces(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if f.slowTraces == nil || f.slowTraces.TraceDurationMs != "100" {
		t.Fatalf("query = %+v: durationMs is the documented name and must win", f.slowTraces)
	}
}

func TestGetSlowTraces_InvalidLimitIgnored(t *testing.T) {
	for _, raw := range []string{"0", "-3", "abc"} {
		f := &capturingApmService{}
		c, w := makeCtx(http.MethodGet, "/apm/traces/slow?limit="+raw, nil, nil)
		NewHandler(f).GetSlowTraces(c)
		if w.Code != http.StatusOK {
			t.Fatalf("limit=%s: status = %d", raw, w.Code)
		}
		if f.slowTraces == nil || f.slowTraces.Limit != 0 {
			t.Fatalf("limit=%s: query = %+v, want the service default to apply", raw, f.slowTraces)
		}
	}
}

func TestGetSlowTraces_BadRequestAnswers400(t *testing.T) {
	f := &capturingApmService{slowTracesErr: fmt.Errorf("durationMs must be a non-negative integer, got %q: %w", "fast", sentinel.BadRequest)}
	c, w := makeCtx(http.MethodGet, "/apm/traces/slow?durationMs=fast", nil, nil)
	NewHandler(f).GetSlowTraces(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
}

func TestGetSlowTraces_QueryFailureAnswers500(t *testing.T) {
	f := &capturingApmService{slowTracesErr: errors.New("query trace_spans for slow traces: dial tcp")}
	c, w := makeCtx(http.MethodGet, "/apm/traces/slow", nil, nil)
	NewHandler(f).GetSlowTraces(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
}

func TestGetServiceTopology_AbsentFlagMeansIncludeDependencies(t *testing.T) {
	f := &capturingApmService{}
	c, w := makeCtx(http.MethodGet, "/apm/services/topology", nil, nil)
	NewHandler(f).GetServiceTopology(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if f.topologyQuery == nil || !f.topologyQuery.IncludeDependencies {
		t.Fatalf("query = %+v: the frontend never sends the flag, so absent must mean include", f.topologyQuery)
	}
}

func TestGetServiceTopology_FalseFlagExcludesDependencies(t *testing.T) {
	f := &capturingApmService{}
	c, w := makeCtx(http.MethodGet, "/apm/services/topology?includeDependencies=false&service=api", nil, nil)
	NewHandler(f).GetServiceTopology(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if f.topologyQuery == nil || f.topologyQuery.IncludeDependencies || f.topologyQuery.Service != "api" {
		t.Fatalf("query = %+v", f.topologyQuery)
	}
}

func TestGetServiceTopology_TrueFlagIncludesDependencies(t *testing.T) {
	f := &capturingApmService{}
	c, w := makeCtx(http.MethodGet, "/apm/services/topology?includeDependencies=true", nil, nil)
	NewHandler(f).GetServiceTopology(c)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if f.topologyQuery == nil || !f.topologyQuery.IncludeDependencies {
		t.Fatalf("query = %+v", f.topologyQuery)
	}
}

func TestGetServiceTopology_QueryFailureAnswers500(t *testing.T) {
	f := &capturingApmService{topologyErr: errors.New("query trace_spans for service nodes: dial tcp")}
	c, w := makeCtx(http.MethodGet, "/apm/services/topology", nil, nil)
	NewHandler(f).GetServiceTopology(c)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
}
