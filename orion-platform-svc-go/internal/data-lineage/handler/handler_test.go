package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/data-lineage/service"

	"context"
	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/data-lineage/models"
)

func newHandler() *Handler {
	return NewHandler(&fakeData_lineageService{})
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

type fakeData_lineageService struct{}

func (f *fakeData_lineageService) CreateLineage(ctx context.Context, tenantID string, req *models.CreateLineageRequest) (*models.Lineage, error) {
	return &models.Lineage{}, nil
}

func (f *fakeData_lineageService) CreateNode(ctx context.Context, tenantID string, lineageID string, req *models.CreateNodeRequest) (*models.Node, error) {
	return &models.Node{}, nil
}

func (f *fakeData_lineageService) CreateRelationship(ctx context.Context, tenantID string, lineageID string, req *models.CreateRelationshipRequest) (*models.Relationship, error) {
	return &models.Relationship{}, nil
}

func (f *fakeData_lineageService) DeleteLineage(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeData_lineageService) GetLineage(ctx context.Context, tenantID, id string) (*models.Lineage, error) {
	return &models.Lineage{}, nil
}

func (f *fakeData_lineageService) GetStats(ctx context.Context, tenantID string) (*models.LineageStats, error) {
	return &models.LineageStats{}, nil
}

func (f *fakeData_lineageService) ListLineages(ctx context.Context, tenantID string, status *string) ([]models.Lineage, error) {
	return []models.Lineage{}, nil
}

func (f *fakeData_lineageService) ListNodes(ctx context.Context, tenantID, lineageID string) ([]models.Node, error) {
	return []models.Node{}, nil
}

func (f *fakeData_lineageService) ListRelationships(ctx context.Context, tenantID, lineageID string) ([]models.Relationship, error) {
	return []models.Relationship{}, nil
}

func (f *fakeData_lineageService) UpdateLineage(ctx context.Context, tenantID, id string, req *models.UpdateLineageRequest) (*models.Lineage, error) {
	return &models.Lineage{}, nil
}

var _ service.ServiceInterface = (*fakeData_lineageService)(nil)

func TestHandler_DATA_LINEAGE_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_DATA_LINEAGE_ListLineages(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListLineages(c)
	if w.Code >= 500 {
		t.Fatalf("ListLineages: got %d", w.Code)
	}
}
func TestHandler_DATA_LINEAGE_CreateLineage(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateLineage(c)
	if w.Code >= 500 {
		t.Fatalf("CreateLineage: got %d", w.Code)
	}
}
func TestHandler_DATA_LINEAGE_GetLineage(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetLineage(c)
	if w.Code >= 500 {
		t.Fatalf("GetLineage: got %d", w.Code)
	}
}
func TestHandler_DATA_LINEAGE_UpdateLineage(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateLineage(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateLineage: got %d", w.Code)
	}
}
func TestHandler_DATA_LINEAGE_DeleteLineage(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteLineage(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteLineage: got %d", w.Code)
	}
}
func TestHandler_DATA_LINEAGE_CreateNode(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateNode(c)
	if w.Code >= 500 {
		t.Fatalf("CreateNode: got %d", w.Code)
	}
}
func TestHandler_DATA_LINEAGE_ListNodes(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListNodes(c)
	if w.Code >= 500 {
		t.Fatalf("ListNodes: got %d", w.Code)
	}
}
func TestHandler_DATA_LINEAGE_CreateRelationship(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateRelationship(c)
	if w.Code >= 500 {
		t.Fatalf("CreateRelationship: got %d", w.Code)
	}
}
func TestHandler_DATA_LINEAGE_GetStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
