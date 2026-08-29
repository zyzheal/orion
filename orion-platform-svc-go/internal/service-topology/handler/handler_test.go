package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/service-topology/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/service-topology/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeService_topologyService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeService_topologyService struct{}

func (f *fakeService_topologyService) AddDependency(ctx context.Context, tenantID, source, target string, relType models.RelationType) error {
	return nil
}

func (f *fakeService_topologyService) Create(ctx context.Context, tenantID string, req models.CreateServiceTopologyRequest) (*models.ServiceTopology, error) {
	return &models.ServiceTopology{}, nil
}

func (f *fakeService_topologyService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeService_topologyService) DetectCycles(ctx context.Context, tenantID string) ([][]string, error) {
	return [][]string{}, nil
}

func (f *fakeService_topologyService) FindImpactScope(ctx context.Context, tenantID, serviceName string) (*models.ImpactScope, error) {
	return &models.ImpactScope{}, nil
}

func (f *fakeService_topologyService) Get(ctx context.Context, tenantID, id string) (*models.ServiceTopology, error) {
	return &models.ServiceTopology{}, nil
}

func (f *fakeService_topologyService) GetByServiceName(ctx context.Context, tenantID, serviceName string) (*models.ServiceTopology, error) {
	return &models.ServiceTopology{}, nil
}

func (f *fakeService_topologyService) GetDependencies(ctx context.Context, tenantID, serviceName string) ([]models.TopologyEdge, error) {
	return []models.TopologyEdge{}, nil
}

func (f *fakeService_topologyService) GetDownstreamDependents(ctx context.Context, tenantID, serviceName string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeService_topologyService) GetTopologyStats(ctx context.Context, tenantID string) (*models.TopologyStats, error) {
	return &models.TopologyStats{}, nil
}

func (f *fakeService_topologyService) GetUpstreamDependencies(ctx context.Context, tenantID, serviceName string) ([]string, error) {
	return []string{}, nil
}

func (f *fakeService_topologyService) List(ctx context.Context, tenantID string) ([]models.ServiceTopology, error) {
	return []models.ServiceTopology{}, nil
}

func (f *fakeService_topologyService) RemoveDependency(ctx context.Context, tenantID, source, target string) error {
	return nil
}

func (f *fakeService_topologyService) Update(ctx context.Context, tenantID, id string, req models.UpdateServiceTopologyRequest) (*models.ServiceTopology, error) {
	return &models.ServiceTopology{}, nil
}

func (f *fakeService_topologyService) ValidateTopology(ctx context.Context, tenantID string) (*models.ValidateTopologyResult, error) {
	return &models.ValidateTopologyResult{}, nil
}

var _ service.ServiceInterface = (*fakeService_topologyService)(nil)

func TestHandler_SERVICE_TOPOLO_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SERVICE_TOPO_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_SERVICE_TOPO_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_SERVICE_TOPO_GetByServiceName(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetByServiceName(c)
	if w.Code >= 500 {
		t.Fatalf("GetByServiceName: got %d", w.Code)
	}
}
func TestHandler_SERVICE_TOPO_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_SERVICE_TOPO_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_SERVICE_TOPO_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_SERVICE_TOPO_AddDependency(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AddDependency(c)
	if w.Code >= 500 {
		t.Fatalf("AddDependency: got %d", w.Code)
	}
}
func TestHandler_SERVICE_TOPO_RemoveDependency(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RemoveDependency(c)
	if w.Code >= 500 {
		t.Fatalf("RemoveDependency: got %d", w.Code)
	}
}
func TestHandler_SERVICE_TOPO_GetDependencies(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDependencies(c)
	if w.Code >= 500 {
		t.Fatalf("GetDependencies: got %d", w.Code)
	}
}
func TestHandler_SERVICE_TOPO_GetUpstreamDependencies(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetUpstreamDependencies(c)
	if w.Code >= 500 {
		t.Fatalf("GetUpstreamDependencies: got %d", w.Code)
	}
}
func TestHandler_SERVICE_TOPO_GetDownstreamDependents(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDownstreamDependents(c)
	if w.Code >= 500 {
		t.Fatalf("GetDownstreamDependents: got %d", w.Code)
	}
}
func TestHandler_SERVICE_TOPO_FindImpactScope(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().FindImpactScope(c)
	if w.Code >= 500 {
		t.Fatalf("FindImpactScope: got %d", w.Code)
	}
}
func TestHandler_SERVICE_TOPO_DetectCycles(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DetectCycles(c)
	if w.Code >= 500 {
		t.Fatalf("DetectCycles: got %d", w.Code)
	}
}
func TestHandler_SERVICE_TOPO_GetTopologyStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTopologyStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetTopologyStats: got %d", w.Code)
	}
}
