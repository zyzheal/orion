package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/escalation/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/escalation/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeEscalationService{})
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
type fakeEscalationService struct{}

func (f *fakeEscalationService) CreateRule(ctx context.Context, tenantID string, req models.TriggerRequest) (*models.EscalationRule, error) {
	return &models.EscalationRule{}, nil
}

func (f *fakeEscalationService) DeleteRule(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeEscalationService) GetEventsByRule(ctx context.Context, tenantID, ruleID string) ([]models.TriggerEvent, error) {
	return []models.TriggerEvent{}, nil
}

func (f *fakeEscalationService) GetRule(ctx context.Context, tenantID, id string) (*models.EscalationRule, error) {
	return &models.EscalationRule{}, nil
}

func (f *fakeEscalationService) GetStats(ctx context.Context, tenantID string) (*models.EscalationStats, error) {
	return &models.EscalationStats{}, nil
}

func (f *fakeEscalationService) ListRules(ctx context.Context, tenantID string, q models.ListRulesQuery) ([]models.EscalationRule, error) {
	return []models.EscalationRule{}, nil
}

func (f *fakeEscalationService) TriggerRule(ctx context.Context, tenantID, id string, req models.TriggerRequest) (*models.TriggerEvent, error) {
	return &models.TriggerEvent{}, nil
}

func (f *fakeEscalationService) UpdateRule(ctx context.Context, tenantID, id string, req models.TriggerRequest) (*models.EscalationRule, error) {
	return &models.EscalationRule{}, nil
}

var _ service.ServiceInterface = (*fakeEscalationService)(nil)
=======
type fakeescalationService struct{}

func (f *fakeescalationService) CreateRule(ctx context.Context, tenantID string, req models.TriggerRequest) ((*models.EscalationRule, error)) {
	return &models.EscalationRule{}, nil
}

func (f *fakeescalationService) DeleteRule(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakeescalationService) GetEventsByRule(ctx context.Context, tenantID, ruleID string) (([]models.TriggerEvent, error)) {
	return []models.TriggerEvent{}, nil
}

func (f *fakeescalationService) GetRule(ctx context.Context, tenantID, id string) ((*models.EscalationRule, error)) {
	return &models.EscalationRule{}, nil
}

func (f *fakeescalationService) GetStats(ctx context.Context, tenantID string) ((*models.EscalationStats, error)) {
	return &models.EscalationStats{}, nil
}

func (f *fakeescalationService) ListRules(ctx context.Context, tenantID string, q models.ListRulesQuery) (([]models.EscalationRule, error)) {
	return []models.EscalationRule{}, nil
}

func (f *fakeescalationService) TriggerRule(ctx context.Context, tenantID, id string, req models.TriggerRequest) ((*models.TriggerEvent, error)) {
	return &models.TriggerEvent{}, nil
}

func (f *fakeescalationService) UpdateRule(ctx context.Context, tenantID, id string, req models.TriggerRequest) ((*models.EscalationRule, error)) {
	return &models.EscalationRule{}, nil
}

var _ service.ServiceInterface = (*fakeescalationService)(nil)
>>>>>>> Stashed changes


func TestHandler_ESCALATION_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_ESCALATION_CreateRule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateRule(c)
	if w.Code >= 500 {
		t.Fatalf("CreateRule: got %d", w.Code)
	}
}
func TestHandler_ESCALATION_DeleteRule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteRule(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteRule: got %d", w.Code)
	}
}
func TestHandler_ESCALATION_GetRule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetRule(c)
	if w.Code >= 500 {
		t.Fatalf("GetRule: got %d", w.Code)
	}
}
func TestHandler_ESCALATION_GetStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
func TestHandler_ESCALATION_ListRules(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListRules(c)
	if w.Code >= 500 {
		t.Fatalf("ListRules: got %d", w.Code)
	}
}
func TestHandler_ESCALATION_TriggerRule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().TriggerRule(c)
	if w.Code >= 500 {
		t.Fatalf("TriggerRule: got %d", w.Code)
	}
}
func TestHandler_ESCALATION_UpdateRule(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateRule(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateRule: got %d", w.Code)
	}
}
