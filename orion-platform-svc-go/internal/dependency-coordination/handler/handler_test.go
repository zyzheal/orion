package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/dependency-coordination/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/dependency-coordination/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeDependency_coordinationService{})
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
type fakeDependency_coordinationService struct{}

func (f *fakeDependency_coordinationService) Create(ctx context.Context, tenantID string, req *models.CreateDependencyCoordinationRequest) (*models.DependencyCoordination, error) {
	return &models.DependencyCoordination{}, nil
}

func (f *fakeDependency_coordinationService) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeDependency_coordinationService) Get(ctx context.Context, tenantID, id string) (*models.DependencyCoordination, error) {
	return &models.DependencyCoordination{}, nil
}

func (f *fakeDependency_coordinationService) List(ctx context.Context, tenantID string) ([]models.DependencyCoordination, error) {
	return []models.DependencyCoordination{}, nil
}

func (f *fakeDependency_coordinationService) Update(ctx context.Context, tenantID, id string, req *models.UpdateDependencyCoordinationRequest) (*models.DependencyCoordination, error) {
	return &models.DependencyCoordination{}, nil
}

var _ service.ServiceInterface = (*fakeDependency_coordinationService)(nil)
=======
type fakedependency_coordinationService struct{}

func (f *fakedependency_coordinationService) Create(ctx context.Context, tenantID string, req *models.CreateDependencyCoordinationRequest) ((*models.DependencyCoordination, error)) {
	return &models.DependencyCoordination{}, nil
}

func (f *fakedependency_coordinationService) Delete(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakedependency_coordinationService) Get(ctx context.Context, tenantID, id string) ((*models.DependencyCoordination, error)) {
	return &models.DependencyCoordination{}, nil
}

func (f *fakedependency_coordinationService) List(ctx context.Context, tenantID string) (([]models.DependencyCoordination, error)) {
	return []models.DependencyCoordination{}, nil
}

func (f *fakedependency_coordinationService) Update(ctx context.Context, tenantID, id string, req *models.UpdateDependencyCoordinationRequest) ((*models.DependencyCoordination, error)) {
	return &models.DependencyCoordination{}, nil
}

var _ service.ServiceInterface = (*fakedependency_coordinationService)(nil)
>>>>>>> Stashed changes


func TestHandler_DEPENDENCY_COO_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_DEPENDENCY_C_List(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().List(c)
	if w.Code >= 500 {
		t.Fatalf("List: got %d", w.Code)
	}
}
func TestHandler_DEPENDENCY_C_Create(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Create(c)
	if w.Code >= 500 {
		t.Fatalf("Create: got %d", w.Code)
	}
}
func TestHandler_DEPENDENCY_C_Get(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Get(c)
	if w.Code >= 500 {
		t.Fatalf("Get: got %d", w.Code)
	}
}
func TestHandler_DEPENDENCY_C_Update(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Update(c)
	if w.Code >= 500 {
		t.Fatalf("Update: got %d", w.Code)
	}
}
func TestHandler_DEPENDENCY_C_Delete(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().Delete(c)
	if w.Code >= 500 {
		t.Fatalf("Delete: got %d", w.Code)
	}
}
