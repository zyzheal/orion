package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"orion/platform-svc-go/internal/oci-registry/models"
	"testing"

	"orion/platform-svc-go/internal/oci-registry/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&fakeOciRegistryService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeOciRegistryService struct{}

func (f *fakeOciRegistryService) ToggleRegistry(ctx context.Context, tenantID, registryID string, req *models.ToggleRegistryRequest) (*models.OciRegistry, error) {
	return &models.OciRegistry{}, nil
}

func (f *fakeOciRegistryService) ListTags(ctx context.Context, tenantID, registryID, repoName string, q *models.TagsQuery) (*models.TagsResponse, error) {
	return &models.TagsResponse{}, nil
}

func (f *fakeOciRegistryService) DeleteImage(ctx context.Context, tenantID, registryID, name, digest string) error {
	return nil
}

func (f *fakeOciRegistryService) Create(ctx context.Context, tenantID string, req models.CreateOciRegistryRequest) (*models.OciRegistry, error) {
	return &models.OciRegistry{}, nil
}

func (f *fakeOciRegistryService) Get(ctx context.Context, tenantID, id string) (*models.OciRegistry, error) {
	return &models.OciRegistry{}, nil
}

func (f *fakeOciRegistryService) List(ctx context.Context, tenantID string) ([]models.OciRegistry, error) {
	return []models.OciRegistry{}, nil
}

func (f *fakeOciRegistryService) Update(ctx context.Context, tenantID, id string, req models.UpdateOciRegistryRequest) (*models.OciRegistry, error) {
	return &models.OciRegistry{}, nil
}

func (f *fakeOciRegistryService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

var _ service.ServiceInterface = (*fakeOciRegistryService)(nil)

func TestHandler_OCI_REGISTRY_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_OCI_REGISTRY_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_OCI_REGISTRY_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_OCI_REGISTRY_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_OCI_REGISTRY_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_OCI_REGISTRY_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_OCI_REGISTRY_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_OCI_REGISTRY_ToggleRegistry(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ToggleRegistry(c)
	if w.Code >= 500 {
		t.Fatalf("ToggleRegistry: got %d", w.Code)
	}
}
func TestHandler_OCI_REGISTRY_ListTags(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListTags(c)
	if w.Code >= 500 {
		t.Fatalf("ListTags: got %d", w.Code)
	}
}
func TestHandler_OCI_REGISTRY_DeleteImage(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteImage(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteImage: got %d", w.Code)
	}
}
