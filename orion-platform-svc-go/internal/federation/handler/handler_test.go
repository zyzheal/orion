package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/federation/models"
	"orion/platform-svc-go/internal/federation/service"

	"github.com/gin-gonic/gin"
)

// --- mock Service (implements handler.Service) ---

type mockSvc struct {
	createFn               func(ctx context.Context, tenantID string, req *models.CreateFederatedClusterRequest) (*models.FederatedCluster, error)
	listFn                 func(ctx context.Context, tenantID string, offset, limit int) ([]models.FederatedCluster, error)
	getByIDFn              func(ctx context.Context, tenantID, id string) (*models.FederatedCluster, error)
	deleteFn               func(ctx context.Context, tenantID, id string) error
	updateFn               func(ctx context.Context, tenantID, id string, req *models.UpdateFederatedClusterRequest) (*models.FederatedCluster, error)
	countFn                func(ctx context.Context, tenantID string) (int, error)
	createFederationFn     func(ctx context.Context, tenantID string, req *models.CreateFederationConfigRequest) (*models.FederationConfig, error)
	getFederationFn        func(ctx context.Context, tenantID, id string) (*models.FederationConfig, error)
	listFederationFn       func(ctx context.Context, tenantID string) ([]models.FederationConfig, error)
	updateFederationFn     func(ctx context.Context, tenantID, id string, req *models.UpdateFederationConfigRequest) (*models.FederationConfig, error)
	deleteFederationFn     func(ctx context.Context, tenantID, id string) error
	registerExecutorFn     func(ctx context.Context, tenantID string, req *models.CreateExecutorRequest) (*models.Executor, error)
	listExecutorsFn        func(ctx context.Context, tenantID string) ([]models.Executor, error)
	getExecutorHealthFn    func(ctx context.Context, tenantID, executorID string) (*models.Executor, *models.ExecutorHealth, error)
	getExecutorDashboardFn func(ctx context.Context, tenantID string) (*models.ExecutorDashboard, error)
	executorHeartbeatFn    func(ctx context.Context, tenantID, executorID string, req *models.ExecutorHeartbeatRequest) (*models.Executor, *models.ExecutorHealth, error)
	deregisterExecutorFn   func(ctx context.Context, tenantID, executorID string) (bool, error)
	dispatchJobFn          func(ctx context.Context, tenantID string, req *models.DispatchJobRequest) (*models.DispatchJobResult, error)
	createSchedulingFn     func(ctx context.Context, tenantID string, req *models.CreateSchedulingPolicyRequest) (*models.SchedulingPolicy, error)
	listSchedulingFn       func(ctx context.Context, tenantID string) ([]models.SchedulingPolicy, error)
	scheduleCrossClusterFn func(ctx context.Context, tenantID string, req *models.ScheduleCrossClusterJobRequest) (*models.CrossClusterJob, error)
	createResourcePoolFn   func(ctx context.Context, tenantID string, req *models.CreateResourcePoolRequest) (*models.ResourcePool, error)
	getResourcePoolStatusFn func(ctx context.Context, tenantID, poolID string) (*models.ResourcePool, error)
}

func (m *mockSvc) Create(ctx context.Context, tenantID string, req *models.CreateFederatedClusterRequest) (*models.FederatedCluster, error) {
	if m.createFn != nil { return m.createFn(ctx, tenantID, req) }
	return nil, nil
}
func (m *mockSvc) List(ctx context.Context, tenantID string, offset, limit int) ([]models.FederatedCluster, error) {
	if m.listFn != nil { return m.listFn(ctx, tenantID, offset, limit) }
	return nil, nil
}
func (m *mockSvc) GetByID(ctx context.Context, tenantID, id string) (*models.FederatedCluster, error) {
	if m.getByIDFn != nil { return m.getByIDFn(ctx, tenantID, id) }
	return nil, nil
}
func (m *mockSvc) Delete(ctx context.Context, tenantID, id string) error {
	if m.deleteFn != nil { return m.deleteFn(ctx, tenantID, id) }
	return nil
}
func (m *mockSvc) Update(ctx context.Context, tenantID, id string, req *models.UpdateFederatedClusterRequest) (*models.FederatedCluster, error) {
	if m.updateFn != nil { return m.updateFn(ctx, tenantID, id, req) }
	return nil, nil
}
func (m *mockSvc) Count(ctx context.Context, tenantID string) (int, error) {
	if m.countFn != nil { return m.countFn(ctx, tenantID) }
	return 0, nil
}
func (m *mockSvc) CreateFederationConfig(ctx context.Context, tenantID string, req *models.CreateFederationConfigRequest) (*models.FederationConfig, error) {
	if m.createFederationFn != nil { return m.createFederationFn(ctx, tenantID, req) }
	return nil, nil
}
func (m *mockSvc) GetFederationConfig(ctx context.Context, tenantID, id string) (*models.FederationConfig, error) {
	if m.getFederationFn != nil { return m.getFederationFn(ctx, tenantID, id) }
	return nil, nil
}
func (m *mockSvc) ListFederationConfigs(ctx context.Context, tenantID string) ([]models.FederationConfig, error) {
	if m.listFederationFn != nil { return m.listFederationFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) UpdateFederationConfig(ctx context.Context, tenantID, id string, req *models.UpdateFederationConfigRequest) (*models.FederationConfig, error) {
	if m.updateFederationFn != nil { return m.updateFederationFn(ctx, tenantID, id, req) }
	return nil, nil
}
func (m *mockSvc) DeleteFederationConfig(ctx context.Context, tenantID, id string) error {
	if m.deleteFederationFn != nil { return m.deleteFederationFn(ctx, tenantID, id) }
	return nil
}
func (m *mockSvc) RegisterExecutor(ctx context.Context, tenantID string, req *models.CreateExecutorRequest) (*models.Executor, error) {
	if m.registerExecutorFn != nil { return m.registerExecutorFn(ctx, tenantID, req) }
	return nil, nil
}
func (m *mockSvc) ListExecutors(ctx context.Context, tenantID string) ([]models.Executor, error) {
	if m.listExecutorsFn != nil { return m.listExecutorsFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) GetExecutorHealth(ctx context.Context, tenantID, executorID string) (*models.Executor, *models.ExecutorHealth, error) {
	if m.getExecutorHealthFn != nil { return m.getExecutorHealthFn(ctx, tenantID, executorID) }
	return nil, nil, nil
}
func (m *mockSvc) GetExecutorDashboard(ctx context.Context, tenantID string) (*models.ExecutorDashboard, error) {
	if m.getExecutorDashboardFn != nil { return m.getExecutorDashboardFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) ExecutorHeartbeat(ctx context.Context, tenantID, executorID string, req *models.ExecutorHeartbeatRequest) (*models.Executor, *models.ExecutorHealth, error) {
	if m.executorHeartbeatFn != nil { return m.executorHeartbeatFn(ctx, tenantID, executorID, req) }
	return nil, nil, nil
}
func (m *mockSvc) DeregisterExecutor(ctx context.Context, tenantID, executorID string) (bool, error) {
	if m.deregisterExecutorFn != nil { return m.deregisterExecutorFn(ctx, tenantID, executorID) }
	return false, nil
}
func (m *mockSvc) DispatchJob(ctx context.Context, tenantID string, req *models.DispatchJobRequest) (*models.DispatchJobResult, error) {
	if m.dispatchJobFn != nil { return m.dispatchJobFn(ctx, tenantID, req) }
	return nil, nil
}
func (m *mockSvc) CreateSchedulingPolicy(ctx context.Context, tenantID string, req *models.CreateSchedulingPolicyRequest) (*models.SchedulingPolicy, error) {
	if m.createSchedulingFn != nil { return m.createSchedulingFn(ctx, tenantID, req) }
	return nil, nil
}
func (m *mockSvc) ListSchedulingPolicies(ctx context.Context, tenantID string) ([]models.SchedulingPolicy, error) {
	if m.listSchedulingFn != nil { return m.listSchedulingFn(ctx, tenantID) }
	return nil, nil
}
func (m *mockSvc) ScheduleCrossClusterJob(ctx context.Context, tenantID string, req *models.ScheduleCrossClusterJobRequest) (*models.CrossClusterJob, error) {
	if m.scheduleCrossClusterFn != nil { return m.scheduleCrossClusterFn(ctx, tenantID, req) }
	return nil, nil
}
func (m *mockSvc) CreateResourcePool(ctx context.Context, tenantID string, req *models.CreateResourcePoolRequest) (*models.ResourcePool, error) {
	if m.createResourcePoolFn != nil { return m.createResourcePoolFn(ctx, tenantID, req) }
	return nil, nil
}
func (m *mockSvc) GetResourcePoolStatus(ctx context.Context, tenantID, poolID string) (*models.ResourcePool, error) {
	if m.getResourcePoolStatusFn != nil { return m.getResourcePoolStatusFn(ctx, tenantID, poolID) }
	return nil, nil
}

// --- helpers ---

func newHandlerWithSvc(svc Service) *Handler {
	return NewHandler(svc)
}

func performRequest(h *Handler, handlerFn func(c *gin.Context), method string, body interface{}, pathParams map[string]string, queryParams map[string]string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")

	buf := new(bytes.Buffer)
	if body != nil {
		json.NewEncoder(buf).Encode(body)
	}
	c.Request = httptest.NewRequest(method, "/", buf)
	c.Params = gin.Params{}
	for k, v := range pathParams {
		c.Params = append(c.Params, gin.Param{Key: k, Value: v})
	}
	for k, v := range queryParams {
		q := c.Request.URL.Query()
		q.Add(k, v)
		c.Request.URL.RawQuery = q.Encode()
	}

	handlerFn(c)
	return w
}

// ==================== Federated Cluster (legacy) ====================

func TestHandler_Create_Success(t *testing.T) {
	cl := &models.FederatedCluster{ID: "c1", Name: "prod"}
	h := newHandlerWithSvc(&mockSvc{
		createFn: func(ctx context.Context, tenantID string, req *models.CreateFederatedClusterRequest) (*models.FederatedCluster, error) { return cl, nil },
	})
	w := performRequest(h, h.Create, "POST", models.CreateFederatedClusterRequest{Name: "prod", PeerURL: "https://a", Protocol: "grpc"}, nil, nil)
	if w.Code != http.StatusCreated { t.Fatalf("expected 201, got %d", w.Code) }
}

func TestHandler_Create_BadRequest(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{})
	w := performRequest(h, h.Create, "POST", models.CreateFederatedClusterRequest{}, nil, nil)
	if w.Code != http.StatusBadRequest { t.Fatalf("expected 400, got %d", w.Code) }
}

func TestHandler_List_Success(t *testing.T) {
	list := []models.FederatedCluster{{ID: "c1"}}
	h := newHandlerWithSvc(&mockSvc{
		listFn: func(ctx context.Context, tenantID string, offset, limit int) ([]models.FederatedCluster, error) { return list, nil },
	})
	w := performRequest(h, h.List, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_Get_Success(t *testing.T) {
	cl := &models.FederatedCluster{ID: "c1"}
	h := newHandlerWithSvc(&mockSvc{
		getByIDFn: func(ctx context.Context, tenantID, id string) (*models.FederatedCluster, error) { return cl, nil },
	})
	w := performRequest(h, h.Get, "GET", nil, map[string]string{"id": "c1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_Get_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getByIDFn: func(ctx context.Context, tenantID, id string) (*models.FederatedCluster, error) { return nil, service.ErrFederatedClusterNotFound },
	})
	w := performRequest(h, h.Get, "GET", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound { t.Fatalf("expected 404, got %d", w.Code) }
}

func TestHandler_Delete_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		deleteFn: func(ctx context.Context, tenantID, id string) error { return nil },
	})
	w := performRequest(h, h.Delete, "DELETE", nil, map[string]string{"id": "c1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_Count_Success(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		countFn: func(ctx context.Context, tenantID string) (int, error) { return 3, nil },
	})
	w := performRequest(h, h.Count, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

// ==================== Federation Config ====================

func TestHandler_CreateFederation_Success(t *testing.T) {
	c := &models.FederationConfig{ID: "fed-1", Name: "primary"}
	h := newHandlerWithSvc(&mockSvc{
		createFederationFn: func(ctx context.Context, tenantID string, req *models.CreateFederationConfigRequest) (*models.FederationConfig, error) { return c, nil },
	})
	w := performRequest(h, h.CreateFederation, "POST", models.CreateFederationConfigRequest{Name: "primary"}, nil, nil)
	if w.Code != http.StatusCreated { t.Fatalf("expected 201, got %d", w.Code) }
}

func TestHandler_GetFederation_Success(t *testing.T) {
	c := &models.FederationConfig{ID: "fed-1"}
	h := newHandlerWithSvc(&mockSvc{
		getFederationFn: func(ctx context.Context, tenantID, id string) (*models.FederationConfig, error) { return c, nil },
	})
	w := performRequest(h, h.GetFederation, "GET", nil, map[string]string{"id": "fed-1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_GetFederation_NotFound(t *testing.T) {
	h := newHandlerWithSvc(&mockSvc{
		getFederationFn: func(ctx context.Context, tenantID, id string) (*models.FederationConfig, error) { return nil, service.ErrFederatedClusterNotFound },
	})
	w := performRequest(h, h.GetFederation, "GET", nil, map[string]string{"id": "x"}, nil)
	if w.Code != http.StatusNotFound { t.Fatalf("expected 404, got %d", w.Code) }
}

func TestHandler_ListFederations_Success(t *testing.T) {
	cs := []models.FederationConfig{{ID: "f1"}}
	h := newHandlerWithSvc(&mockSvc{
		listFederationFn: func(ctx context.Context, tenantID string) ([]models.FederationConfig, error) { return cs, nil },
	})
	w := performRequest(h, h.ListFederations, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

// ==================== Executor ====================

func TestHandler_RegisterExecutor_Success(t *testing.T) {
	e := &models.Executor{ID: "exec-1"}
	h := newHandlerWithSvc(&mockSvc{
		registerExecutorFn: func(ctx context.Context, tenantID string, req *models.CreateExecutorRequest) (*models.Executor, error) { return e, nil },
	})
	w := performRequest(h, h.RegisterExecutor, "POST", models.CreateExecutorRequest{ClusterID: "c1", Name: "e1", Region: "us-east"}, nil, nil)
	if w.Code != http.StatusCreated { t.Fatalf("expected 201, got %d", w.Code) }
}

func TestHandler_ListExecutors_Success(t *testing.T) {
	es := []models.Executor{{ID: "e1"}}
	h := newHandlerWithSvc(&mockSvc{
		listExecutorsFn: func(ctx context.Context, tenantID string) ([]models.Executor, error) { return es, nil },
	})
	w := performRequest(h, h.ListExecutors, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

func TestHandler_GetExecutorDashboard_Success(t *testing.T) {
	d := &models.ExecutorDashboard{TotalExecutors: 2}
	h := newHandlerWithSvc(&mockSvc{
		getExecutorDashboardFn: func(ctx context.Context, tenantID string) (*models.ExecutorDashboard, error) { return d, nil },
	})
	w := performRequest(h, h.GetExecutorDashboard, "GET", nil, nil, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}

// ==================== Scheduling Policy ====================

func TestHandler_CreateSchedulingPolicy_Success(t *testing.T) {
	p := &models.SchedulingPolicy{ID: "policy-1", Name: "balanced"}
	h := newHandlerWithSvc(&mockSvc{
		createSchedulingFn: func(ctx context.Context, tenantID string, req *models.CreateSchedulingPolicyRequest) (*models.SchedulingPolicy, error) { return p, nil },
	})
	w := performRequest(h, h.CreateSchedulingPolicy, "POST", models.CreateSchedulingPolicyRequest{Name: "balanced"}, nil, nil)
	if w.Code != http.StatusCreated { t.Fatalf("expected 201, got %d", w.Code) }
}

// ==================== Cross-Cluster Job ====================

func TestHandler_ScheduleCrossClusterJob_Success(t *testing.T) {
	j := &models.CrossClusterJob{ID: "ccjob-1"}
	h := newHandlerWithSvc(&mockSvc{
		scheduleCrossClusterFn: func(ctx context.Context, tenantID string, req *models.ScheduleCrossClusterJobRequest) (*models.CrossClusterJob, error) { return j, nil },
	})
	w := performRequest(h, h.ScheduleCrossClusterJob, "POST", models.ScheduleCrossClusterJobRequest{Name: "migrate", TargetClusters: []string{"a", "b"}}, nil, nil)
	if w.Code != http.StatusCreated { t.Fatalf("expected 201, got %d", w.Code) }
}

// ==================== Resource Pool ====================

func TestHandler_CreateResourcePool_Success(t *testing.T) {
	pool := &models.ResourcePool{ID: "pool-1", Name: "main"}
	h := newHandlerWithSvc(&mockSvc{
		createResourcePoolFn: func(ctx context.Context, tenantID string, req *models.CreateResourcePoolRequest) (*models.ResourcePool, error) { return pool, nil },
	})
	w := performRequest(h, h.CreateResourcePool, "POST", models.CreateResourcePoolRequest{Name: "main", ClusterID: "c1"}, nil, nil)
	if w.Code != http.StatusCreated { t.Fatalf("expected 201, got %d", w.Code) }
}

func TestHandler_GetResourcePoolStatus_Success(t *testing.T) {
	pool := &models.ResourcePool{ID: "pool-1"}
	h := newHandlerWithSvc(&mockSvc{
		getResourcePoolStatusFn: func(ctx context.Context, tenantID, poolID string) (*models.ResourcePool, error) { return pool, nil },
	})
	w := performRequest(h, h.GetResourcePoolStatus, "GET", nil, map[string]string{"poolId": "pool-1"}, nil)
	if w.Code != http.StatusOK { t.Fatalf("expected 200, got %d", w.Code) }
}
