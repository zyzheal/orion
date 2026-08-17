package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/vector/service"

	"github.com/gin-gonic/gin"
	"context"
<<<<<<< Updated upstream
	"orion/platform-svc-go/internal/vector/models"
=======
>>>>>>> Stashed changes
)

func newHandler() *Handler {
	return NewHandler(&fakeVectorService{})
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
type fakeVectorService struct{}

func (f *fakeVectorService) CreateStore(ctx context.Context, tenantID string, req models.CreateStoreRequest) (*models.VectorStore, error) {
	return &models.VectorStore{}, nil
}

func (f *fakeVectorService) DeleteStore(ctx context.Context, tenantID, id string) error {
	return nil
}

func (f *fakeVectorService) DeleteVectors(ctx context.Context, tenantID, storeID string, ids []string) (int, error) {
	return 0, nil
}

func (f *fakeVectorService) GetStore(ctx context.Context, tenantID, id string) (*models.VectorStore, error) {
	return &models.VectorStore{}, nil
}

func (f *fakeVectorService) ListStores(ctx context.Context, tenantID string, limit, offset int) ([]models.VectorStore, error) {
	return []models.VectorStore{}, nil
}

func (f *fakeVectorService) SearchVectors(ctx context.Context, tenantID, storeID string, q models.SearchQuery) ([]models.SearchResult, error) {
	return []models.SearchResult{}, nil
}

func (f *fakeVectorService) UpsertVectors(ctx context.Context, tenantID, storeID string, req models.UpsertVectorsRequest) error {
	return nil
}

var _ service.ServiceInterface = (*fakeVectorService)(nil)
=======
type fakevectorService struct{}

func (f *fakevectorService) CreateStore(ctx context.Context, tenantID string, req models.CreateStoreRequest) ((*models.VectorStore, error)) {
	return &models.VectorStore{}, nil
}

func (f *fakevectorService) DeleteStore(ctx context.Context, tenantID, id string) (error) {
	return nil
}

func (f *fakevectorService) DeleteVectors(ctx context.Context, tenantID, storeID string, ids []string) ((int, error)) {
	return 0, nil
}

func (f *fakevectorService) GetStore(ctx context.Context, tenantID, id string) ((*models.VectorStore, error)) {
	return &models.VectorStore{}, nil
}

func (f *fakevectorService) ListStores(ctx context.Context, tenantID string, limit, offset int) (([]models.VectorStore, error)) {
	return []models.VectorStore{}, nil
}

func (f *fakevectorService) SearchVectors(ctx context.Context, tenantID, storeID string, q models.SearchQuery) (([]models.SearchResult, error)) {
	return []models.SearchResult{}, nil
}

func (f *fakevectorService) UpsertVectors(ctx context.Context, tenantID, storeID string, req models.UpsertVectorsRequest) (error) {
	return nil
}

var _ service.ServiceInterface = (*fakevectorService)(nil)
>>>>>>> Stashed changes


func TestHandler_VECTOR_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_VECTOR_CreateStore(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateStore(c)
	if w.Code >= 500 {
		t.Fatalf("CreateStore: got %d", w.Code)
	}
}
func TestHandler_VECTOR_DeleteStore(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteStore(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteStore: got %d", w.Code)
	}
}
func TestHandler_VECTOR_DeleteVectors(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteVectors(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteVectors: got %d", w.Code)
	}
}
func TestHandler_VECTOR_GetStore(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStore(c)
	if w.Code >= 500 {
		t.Fatalf("GetStore: got %d", w.Code)
	}
}
func TestHandler_VECTOR_ListStores(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListStores(c)
	if w.Code >= 500 {
		t.Fatalf("ListStores: got %d", w.Code)
	}
}
func TestHandler_VECTOR_SearchVectors(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SearchVectors(c)
	if w.Code >= 500 {
		t.Fatalf("SearchVectors: got %d", w.Code)
	}
}
func TestHandler_VECTOR_UpsertVectors(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpsertVectors(c)
	if w.Code >= 500 {
		t.Fatalf("UpsertVectors: got %d", w.Code)
	}
}
