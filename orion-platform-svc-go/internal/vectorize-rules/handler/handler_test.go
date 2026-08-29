package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/vectorize-rules/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/vectorize-rules/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeVectorize_rulesService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeVectorize_rulesService struct{}

func (f *fakeVectorize_rulesService) Create(ctx context.Context, tenantID string, req models.CreateVectorizeRulesRequest) (*models.VectorizeRules, error) {
	return &models.VectorizeRules{}, nil
}

func (f *fakeVectorize_rulesService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeVectorize_rulesService) Get(ctx context.Context, tenantID, id string) (*models.VectorizeRules, error) {
	return &models.VectorizeRules{}, nil
}

func (f *fakeVectorize_rulesService) List(ctx context.Context, tenantID string) ([]models.VectorizeRules, error) {
	return []models.VectorizeRules{}, nil
}

func (f *fakeVectorize_rulesService) Update(ctx context.Context, tenantID, id string, req models.UpdateVectorizeRulesRequest) (*models.VectorizeRules, error) {
	return &models.VectorizeRules{}, nil
}

var _ service.ServiceInterface = (*fakeVectorize_rulesService)(nil)

func TestHandler_VECTORIZE_RULE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_VECTORIZE_RU_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_VECTORIZE_RU_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_VECTORIZE_RU_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_VECTORIZE_RU_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_VECTORIZE_RU_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
