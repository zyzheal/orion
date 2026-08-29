package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/sla/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/sla/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeSlaService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeSlaService struct{}

func (f *fakeSlaService) CreateDefinition(ctx context.Context, tenantID string, req models.CreateDefinitionRequest) (*models.SLADefinition, error) {
	return &models.SLADefinition{}, nil
}

func (f *fakeSlaService) DeleteDefinition(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeSlaService) DetectBreaches(ctx context.Context, tenantID string) (*models.DetectionResult, error) {
	return &models.DetectionResult{}, nil
}

func (f *fakeSlaService) GetBreachEvents(ctx context.Context, trackingID string) ([]models.SLABreachEvent, error) {
	return []models.SLABreachEvent{}, nil
}

func (f *fakeSlaService) GetDefinition(ctx context.Context, tenantID, id string) (*models.SLADefinition, error) {
	return &models.SLADefinition{}, nil
}

func (f *fakeSlaService) GetStats(ctx context.Context, tenantID string) (*models.StatsResult, error) {
	return &models.StatsResult{}, nil
}

func (f *fakeSlaService) GetTracking(ctx context.Context, tenantID, id string) (*models.SLATracking, error) {
	return &models.SLATracking{}, nil
}

func (f *fakeSlaService) ListBreachEvents(ctx context.Context, tenantID string, limit, offset int) (*models.BreachListResult, error) {
	return &models.BreachListResult{}, nil
}

func (f *fakeSlaService) ListDefinitions(ctx context.Context, tenantID string, q models.DefinitionListQuery) (*models.DefinitionListResult, error) {
	return &models.DefinitionListResult{}, nil
}

func (f *fakeSlaService) ListTracking(ctx context.Context, tenantID string, q models.TrackingListQuery) (*models.TrackingListResult, error) {
	return &models.TrackingListResult{}, nil
}

func (f *fakeSlaService) MarkBreached(ctx context.Context, tenantID, trackingID, details string) (*models.SLATracking, error) {
	return &models.SLATracking{}, nil
}

func (f *fakeSlaService) MarkMet(ctx context.Context, tenantID, trackingID string) (*models.SLATracking, error) {
	return &models.SLATracking{}, nil
}

func (f *fakeSlaService) PauseTracking(ctx context.Context, tenantID, trackingID, reason string) (*models.SLATracking, error) {
	return &models.SLATracking{}, nil
}

func (f *fakeSlaService) ResumeTracking(ctx context.Context, tenantID, trackingID string) (*models.SLATracking, error) {
	return &models.SLATracking{}, nil
}

func (f *fakeSlaService) StartTracking(ctx context.Context, tenantID string, req models.StartTrackingRequest) (*models.SLATracking, error) {
	return &models.SLATracking{}, nil
}

func (f *fakeSlaService) UpdateDefinition(ctx context.Context, tenantID, id string, req models.UpdateDefinitionRequest) (*models.SLADefinition, error) {
	return &models.SLADefinition{}, nil
}

func (f *fakeSlaService) UpdateTracking(ctx context.Context, tenantID, id string, req models.UpdateTrackingRequest) (*models.SLATracking, error) {
	return &models.SLATracking{}, nil
}

var _ service.ServiceInterface = (*fakeSlaService)(nil)

func TestHandler_SLA_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SLA_ListDefinitions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListDefinitions(c)
	if w.Code >= 500 {
		t.Fatalf("ListDefinitions: got %d", w.Code)
	}
}
func TestHandler_SLA_CreateDefinition(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateDefinition(c)
	if w.Code >= 500 {
		t.Fatalf("CreateDefinition: got %d", w.Code)
	}
}
func TestHandler_SLA_GetDefinition(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetDefinition(c)
	if w.Code >= 500 {
		t.Fatalf("GetDefinition: got %d", w.Code)
	}
}
func TestHandler_SLA_UpdateDefinition(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateDefinition(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateDefinition: got %d", w.Code)
	}
}
func TestHandler_SLA_DeleteDefinition(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteDefinition(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteDefinition: got %d", w.Code)
	}
}
func TestHandler_SLA_StartTracking(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().StartTracking(c)
	if w.Code >= 500 {
		t.Fatalf("StartTracking: got %d", w.Code)
	}
}
func TestHandler_SLA_ListTracking(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListTracking(c)
	if w.Code >= 500 {
		t.Fatalf("ListTracking: got %d", w.Code)
	}
}
func TestHandler_SLA_GetTracking(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetTracking(c)
	if w.Code >= 500 {
		t.Fatalf("GetTracking: got %d", w.Code)
	}
}
func TestHandler_SLA_UpdateTracking(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateTracking(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateTracking: got %d", w.Code)
	}
}
func TestHandler_SLA_MarkMet(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().MarkMet(c)
	if w.Code >= 500 {
		t.Fatalf("MarkMet: got %d", w.Code)
	}
}
func TestHandler_SLA_MarkBreached(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().MarkBreached(c)
	if w.Code >= 500 {
		t.Fatalf("MarkBreached: got %d", w.Code)
	}
}
func TestHandler_SLA_PauseTracking(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().PauseTracking(c)
	if w.Code >= 500 {
		t.Fatalf("PauseTracking: got %d", w.Code)
	}
}
func TestHandler_SLA_ResumeTracking(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ResumeTracking(c)
	if w.Code >= 500 {
		t.Fatalf("ResumeTracking: got %d", w.Code)
	}
}
func TestHandler_SLA_GetBreachEvents(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetBreachEvents(c)
	if w.Code >= 500 {
		t.Fatalf("GetBreachEvents: got %d", w.Code)
	}
}
func TestHandler_SLA_ListBreachEvents(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListBreachEvents(c)
	if w.Code >= 500 {
		t.Fatalf("ListBreachEvents: got %d", w.Code)
	}
}
func TestHandler_SLA_DetectBreaches(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DetectBreaches(c)
	if w.Code >= 500 {
		t.Fatalf("DetectBreaches: got %d", w.Code)
	}
}
func TestHandler_SLA_GetStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
