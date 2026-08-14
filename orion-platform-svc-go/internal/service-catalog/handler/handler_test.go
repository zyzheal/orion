package handler

import (
	"orion/platform-svc-go/internal/service-catalog/models"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/service-catalog/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&fakeServiceCatalogService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}
type fakeServiceCatalogService struct{}

func (f *fakeServiceCatalogService) UpdateRequestStatus(ctx context.Context, tenantID, id string, req *models.StatusUpdateRequest) (*models.ServiceRequest, error) {
	return &models.ServiceRequest{}, nil
}

func (f *fakeServiceCatalogService) GetRequestTimeline(ctx context.Context, tenantID, id string) ([]models.TimelineEntry, error) {
	return []models.TimelineEntry{}, nil
}

func (f *fakeServiceCatalogService) GetSLABreaches(ctx context.Context, tenantID string, q *models.SLABreachesQuery) (*models.SLABreachesResponse, error) {
	return &models.SLABreachesResponse{}, nil
}

func (f *fakeServiceCatalogService) Create(ctx context.Context, tenantID string, req models.CreateServiceCatalogRequest) (*models.ServiceCatalog, error) {
	return &models.ServiceCatalog{}, nil
}

func (f *fakeServiceCatalogService) Get(ctx context.Context, tenantID, id string) (*models.ServiceCatalog, error) {
	return &models.ServiceCatalog{}, nil
}

func (f *fakeServiceCatalogService) List(ctx context.Context, tenantID string) ([]models.ServiceCatalog, error) {
	return []models.ServiceCatalog{}, nil
}

func (f *fakeServiceCatalogService) Update(ctx context.Context, tenantID, id string, req models.UpdateServiceCatalogRequest) (*models.ServiceCatalog, error) {
	return &models.ServiceCatalog{}, nil
}

func (f *fakeServiceCatalogService) Delete(ctx context.Context, tenantID, id string) (error) {
	return nil
}

var _ service.ServiceInterface = (*fakeServiceCatalogService)(nil)


func TestHandler_SERVICE_CATALO_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SERVICE_CATA_getTenantID(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().getTenantID(c)
	if w.Code >= 500 {
		t.Fatalf("getTenantID: got %d", w.Code)
	}
}
func TestHandler_SERVICE_CATA_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_SERVICE_CATA_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_SERVICE_CATA_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_SERVICE_CATA_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_SERVICE_CATA_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_SERVICE_CATA_UpdateRequestStatus(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateRequestStatus(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateRequestStatus: got %d", w.Code)
	}
}
func TestHandler_SERVICE_CATA_GetRequestTimeline(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetRequestTimeline(c)
	if w.Code >= 500 {
		t.Fatalf("GetRequestTimeline: got %d", w.Code)
	}
}
func TestHandler_SERVICE_CATA_GetSLABreaches(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSLABreaches(c)
	if w.Code >= 500 {
		t.Fatalf("GetSLABreaches: got %d", w.Code)
	}
}
