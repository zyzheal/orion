package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/disaster-recovery/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/disaster-recovery/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeDisaster_recoveryService{})
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
type fakeDisaster_recoveryService struct{}

func (f *fakeDisaster_recoveryService) CreatePlan(ctx context.Context, tenantID string, req models.CreateDisasterPlanRequest) (*models.DisasterPlan, error) {
	return &models.DisasterPlan{}, nil
}

func (f *fakeDisaster_recoveryService) GetPlan(ctx context.Context, tenantID, id string) (*models.DisasterPlan, error) {
	return &models.DisasterPlan{}, nil
}

func (f *fakeDisaster_recoveryService) ListPlans(ctx context.Context, tenantID string, limit, offset int) (*models.ListPlansResponse, error) {
	return &models.ListPlansResponse{}, nil
}

func (f *fakeDisaster_recoveryService) ListRuns(ctx context.Context, tenantID, planID string) ([]models.RecoveryRun, error) {
	return []models.RecoveryRun{}, nil
}

func (f *fakeDisaster_recoveryService) RunPlan(ctx context.Context, tenantID, planID string) (*models.RecoveryRun, error) {
	return &models.RecoveryRun{}, nil
}

func (f *fakeDisaster_recoveryService) UpdatePlan(ctx context.Context, tenantID, id string, req models.UpdateDisasterPlanRequest) (*models.DisasterPlan, error) {
	return &models.DisasterPlan{}, nil
}

var _ service.ServiceInterface = (*fakeDisaster_recoveryService)(nil)
=======
type fakedisaster_recoveryService struct{}

func (f *fakedisaster_recoveryService) CreatePlan(ctx context.Context, tenantID string, req models.CreateDisasterPlanRequest) ((*models.DisasterPlan, error)) {
	return &models.DisasterPlan{}, nil
}

func (f *fakedisaster_recoveryService) GetPlan(ctx context.Context, tenantID, id string) ((*models.DisasterPlan, error)) {
	return &models.DisasterPlan{}, nil
}

func (f *fakedisaster_recoveryService) ListPlans(ctx context.Context, tenantID string, limit, offset int) ((*models.ListPlansResponse, error)) {
	return &models.ListPlansResponse{}, nil
}

func (f *fakedisaster_recoveryService) ListRuns(ctx context.Context, tenantID, planID string) (([]models.RecoveryRun, error)) {
	return []models.RecoveryRun{}, nil
}

func (f *fakedisaster_recoveryService) RunPlan(ctx context.Context, tenantID, planID string) ((*models.RecoveryRun, error)) {
	return &models.RecoveryRun{}, nil
}

func (f *fakedisaster_recoveryService) UpdatePlan(ctx context.Context, tenantID, id string, req models.UpdateDisasterPlanRequest) ((*models.DisasterPlan, error)) {
	return &models.DisasterPlan{}, nil
}

var _ service.ServiceInterface = (*fakedisaster_recoveryService)(nil)
>>>>>>> Stashed changes


func TestHandler_DISASTER_RECOV_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_DISASTER_REC_CreatePlan(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreatePlan(c)
	if w.Code >= 500 {
		t.Fatalf("CreatePlan: got %d", w.Code)
	}
}
func TestHandler_DISASTER_REC_GetPlan(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetPlan(c)
	if w.Code >= 500 {
		t.Fatalf("GetPlan: got %d", w.Code)
	}
}
func TestHandler_DISASTER_REC_ListPlans(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListPlans(c)
	if w.Code >= 500 {
		t.Fatalf("ListPlans: got %d", w.Code)
	}
}
func TestHandler_DISASTER_REC_UpdatePlan(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdatePlan(c)
	if w.Code >= 500 {
		t.Fatalf("UpdatePlan: got %d", w.Code)
	}
}
func TestHandler_DISASTER_REC_RunPlan(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RunPlan(c)
	if w.Code >= 500 {
		t.Fatalf("RunPlan: got %d", w.Code)
	}
}
func TestHandler_DISASTER_REC_ListRuns(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListRuns(c)
	if w.Code >= 500 {
		t.Fatalf("ListRuns: got %d", w.Code)
	}
}
