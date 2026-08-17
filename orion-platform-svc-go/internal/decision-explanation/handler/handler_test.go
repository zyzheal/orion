package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/decision-explanation/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/decision-explanation/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeDecision_explanationService{})
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
type fakeDecision_explanationService struct{}

func (f *fakeDecision_explanationService) Create(ctx context.Context, tenantID string, req *models.CreateDecisionExplanationRequest) (*models.DecisionExplanation, error) {
	return &models.DecisionExplanation{}, nil
}

func (f *fakeDecision_explanationService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeDecision_explanationService) Get(ctx context.Context, tenantID, id string) (*models.DecisionExplanation, error) {
	return &models.DecisionExplanation{}, nil
}

func (f *fakeDecision_explanationService) List(ctx context.Context, tenantID string) ([]models.DecisionExplanation, error) {
	return []models.DecisionExplanation{}, nil
}

func (f *fakeDecision_explanationService) Update(ctx context.Context, tenantID, id string, req *models.UpdateDecisionExplanationRequest) (*models.DecisionExplanation, error) {
	return &models.DecisionExplanation{}, nil
}

var _ service.ServiceInterface = (*fakeDecision_explanationService)(nil)
=======
type fakedecision_explanationService struct{}

func (f *fakedecision_explanationService) Create(ctx context.Context, tenantID string, req *models.CreateDecisionExplanationRequest) ((*models.DecisionExplanation, error)) {
	return &models.DecisionExplanation{}, nil
}

func (f *fakedecision_explanationService) Delete(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakedecision_explanationService) Get(ctx context.Context, tenantID, id string) ((*models.DecisionExplanation, error)) {
	return &models.DecisionExplanation{}, nil
}

func (f *fakedecision_explanationService) List(ctx context.Context, tenantID string) (([]models.DecisionExplanation, error)) {
	return []models.DecisionExplanation{}, nil
}

func (f *fakedecision_explanationService) Update(ctx context.Context, tenantID, id string, req *models.UpdateDecisionExplanationRequest) ((*models.DecisionExplanation, error)) {
	return &models.DecisionExplanation{}, nil
}

var _ service.ServiceInterface = (*fakedecision_explanationService)(nil)
>>>>>>> Stashed changes


func TestHandler_DECISION_EXPLA_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_DECISION_EXP_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_DECISION_EXP_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_DECISION_EXP_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_DECISION_EXP_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_DECISION_EXP_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
