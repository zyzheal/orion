package handler

import (
	"orion/platform-svc-go/internal/degradation/models"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/degradation/service"

	"github.com/gin-gonic/gin"
)

func newHandler() *Handler {
	return NewHandler(&fakeDegradationService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}
type fakeDegradationService struct{}

func (f *fakeDegradationService) Create(ctx context.Context, tenantID string, req *models.CreateDegradationRequest) (*models.Degradation, error) {
	return &models.Degradation{}, nil
}

func (f *fakeDegradationService) Get(ctx context.Context, tenantID, id string) (*models.Degradation, error) {
	return &models.Degradation{}, nil
}

func (f *fakeDegradationService) List(ctx context.Context, tenantID string) ([]models.Degradation, error) {
	return []models.Degradation{}, nil
}

func (f *fakeDegradationService) Update(ctx context.Context, tenantID, id string, req *models.UpdateDegradationRequest) (*models.Degradation, error) {
	return &models.Degradation{}, nil
}

func (f *fakeDegradationService) Delete(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakeDegradationService) Evaluate(ctx context.Context, tenantID string, req *models.EvaluateRequest) (*models.EvaluateResponse, error) {
	return &models.EvaluateResponse{}, nil
}

func (f *fakeDegradationService) TriggerDegradation(ctx context.Context, tenantID string, req *models.TriggerRequest) (*models.DegradationStatus, error) {
	return &models.DegradationStatus{}, nil
}

func (f *fakeDegradationService) GetStatus(ctx context.Context, tenantID, policyID string) (*models.DegradationStatus, error) {
	return &models.DegradationStatus{}, nil
}

func (f *fakeDegradationService) Resolve(ctx context.Context, tenantID, policyID string, req *models.ResolveRequest) (*models.DegradationStatus, error) {
	return &models.DegradationStatus{}, nil
}

var _ service.ServiceInterface = (*fakeDegradationService)(nil)



func TestHandler_DEGRADATION_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_DEGRADATION_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_DEGRADATION_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_DEGRADATION_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_DEGRADATION_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_DEGRADATION_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
