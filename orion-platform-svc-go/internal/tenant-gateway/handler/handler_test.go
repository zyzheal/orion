package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/tenant-gateway/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/tenant-gateway/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeTenant_gatewayService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

<<<<<<< Updated upstream
type fakeTenant_gatewayService struct{}

func (f *fakeTenant_gatewayService) Activate(ctx context.Context, tenantID, id string) (*models.Tenant, error) {
	return &models.Tenant{}, nil
}

func (f *fakeTenant_gatewayService) AdjustQuota(ctx context.Context, tenantID, id string, req models.QuotaAdjustmentRequest) (*models.Tenant, error) {
	return &models.Tenant{}, nil
}

func (f *fakeTenant_gatewayService) Create(ctx context.Context, tenantID string, req models.CreateTenantRequest) (*models.Tenant, error) {
	return &models.Tenant{}, nil
}

func (f *fakeTenant_gatewayService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeTenant_gatewayService) Get(ctx context.Context, tenantID, id string) (*models.Tenant, error) {
	return &models.Tenant{}, nil
}

func (f *fakeTenant_gatewayService) GetQuotaStatus(ctx context.Context, tenantID, id string) (*models.QuotaStatusResponse, error) {
	return &models.QuotaStatusResponse{}, nil
}

func (f *fakeTenant_gatewayService) List(ctx context.Context, tenantID string, q models.ListQuery) (*models.TenantListResponse, error) {
	return &models.TenantListResponse{}, nil
}

func (f *fakeTenant_gatewayService) Suspend(ctx context.Context, tenantID, id string) (*models.Tenant, error) {
	return &models.Tenant{}, nil
}

func (f *fakeTenant_gatewayService) Update(ctx context.Context, tenantID, id string, req models.UpdateTenantRequest) (*models.Tenant, error) {
	return &models.Tenant{}, nil
}

var _ service.ServiceInterface = (*fakeTenant_gatewayService)(nil)
=======
type faketenant_gatewayService struct{}

func (f *faketenant_gatewayService) Activate(ctx context.Context, tenantID, id string) ((*models.Tenant, error)) {
	return &models.Tenant{}, nil
}

func (f *faketenant_gatewayService) AdjustQuota(ctx context.Context, tenantID, id string, req models.QuotaAdjustmentRequest) ((*models.Tenant, error)) {
	return &models.Tenant{}, nil
}

func (f *faketenant_gatewayService) Create(ctx context.Context, tenantID string, req models.CreateTenantRequest) ((*models.Tenant, error)) {
	return &models.Tenant{}, nil
}

func (f *faketenant_gatewayService) Delete(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *faketenant_gatewayService) Get(ctx context.Context, tenantID, id string) ((*models.Tenant, error)) {
	return &models.Tenant{}, nil
}

func (f *faketenant_gatewayService) GetQuotaStatus(ctx context.Context, tenantID, id string) ((*models.QuotaStatusResponse, error)) {
	return &models.QuotaStatusResponse{}, nil
}

func (f *faketenant_gatewayService) List(ctx context.Context, tenantID string, q models.ListQuery) ((*models.TenantListResponse, error)) {
	return &models.TenantListResponse{}, nil
}

func (f *faketenant_gatewayService) Suspend(ctx context.Context, tenantID, id string) ((*models.Tenant, error)) {
	return &models.Tenant{}, nil
}

func (f *faketenant_gatewayService) Update(ctx context.Context, tenantID, id string, req models.UpdateTenantRequest) ((*models.Tenant, error)) {
	return &models.Tenant{}, nil
}

var _ service.ServiceInterface = (*faketenant_gatewayService)(nil)
>>>>>>> Stashed changes


func TestHandler_TENANT_GATEWAY_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_TENANT_GATEW_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_TENANT_GATEW_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_TENANT_GATEW_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_TENANT_GATEW_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_TENANT_GATEW_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
func TestHandler_TENANT_GATEW_Suspend(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Suspend(c)
	if w.Code >= 500 {
		t.Fatalf("Suspend: got %d", w.Code)
	}
}
func TestHandler_TENANT_GATEW_Activate(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Activate(c)
	if w.Code >= 500 {
		t.Fatalf("Activate: got %d", w.Code)
	}
}
func TestHandler_TENANT_GATEW_GetQuotaStatus(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetQuotaStatus(c)
	if w.Code >= 500 {
		t.Fatalf("GetQuotaStatus: got %d", w.Code)
	}
}
func TestHandler_TENANT_GATEW_AdjustQuota(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AdjustQuota(c)
	if w.Code >= 500 {
		t.Fatalf("AdjustQuota: got %d", w.Code)
	}
}
