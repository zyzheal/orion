package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/topology/service"

	"github.com/gin-gonic/gin"
	"context"
	"orion/platform-svc-go/internal/topology/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeTopologyService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeTopologyService struct{}

func (f *fakeTopologyService) Create(ctx context.Context, tenantID string, req models.CreateTopologyRequest) (*models.Topology, error) {
	return &models.Topology{}, nil
}

func (f *fakeTopologyService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeTopologyService) Get(ctx context.Context, tenantID, id string) (*models.Topology, error) {
	return &models.Topology{}, nil
}

func (f *fakeTopologyService) List(ctx context.Context, tenantID string) ([]models.Topology, error) {
	return []models.Topology{}, nil
}

func (f *fakeTopologyService) Update(ctx context.Context, tenantID, id string, req models.UpdateTopologyRequest) (*models.Topology, error) {
	return &models.Topology{}, nil
}

var _ service.ServiceInterface = (*fakeTopologyService)(nil)


func TestHandler_TOPOLOGY_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_TOPOLOGY_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_TOPOLOGY_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_TOPOLOGY_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_TOPOLOGY_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_TOPOLOGY_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
