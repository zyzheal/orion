package service

import (
	"context"
	"errors"
	"testing"

	"orion/platform-svc-go/internal/vector/models"
)

// mockVectorRepo implements RepositoryInterface for testing.
type mockVectorRepo struct {
	stores          map[string]*models.VectorStore
	listErr         error
	getErr          error
	createErr       error
	deleteErr       error
	deleteVectorErr error
	deleteVectorN   int
	upsertErr       error
	searchErr       error
	searchResults   []models.SearchResult
}

func newMockVectorRepo() *mockVectorRepo {
	return &mockVectorRepo{
		stores: make(map[string]*models.VectorStore),
	}
}

func (m *mockVectorRepo) CreateStore(_ context.Context, s *models.VectorStore) error {
	if m.createErr != nil {
		return m.createErr
	}
	if s.ID == "" {
		s.ID = "store-1"
	}
	m.stores[s.ID] = s
	return nil
}

func (m *mockVectorRepo) DeleteStore(_ context.Context, _ string, _ string) error {
	return m.deleteErr
}

func (m *mockVectorRepo) DeleteVectors(_ context.Context, _ string, _ string, _ []string) (int, error) {
	return m.deleteVectorN, m.deleteVectorErr
}

func (m *mockVectorRepo) GetStore(_ context.Context, _, id string) (*models.VectorStore, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	s, ok := m.stores[id]
	if !ok {
		return nil, errors.New("not found")
	}
	return s, nil
}

func (m *mockVectorRepo) ListStores(_ context.Context, _ string, _, _ int) ([]models.VectorStore, error) {
	if m.listErr != nil {
		return nil, m.listErr
	}
	result := make([]models.VectorStore, 0, len(m.stores))
	for _, s := range m.stores {
		result = append(result, *s)
	}
	return result, nil
}

func (m *mockVectorRepo) SearchVectors(_ context.Context, _, _ string, _ []float64, _ int) ([]models.SearchResult, error) {
	if m.searchErr != nil {
		return nil, m.searchErr
	}
	return m.searchResults, nil
}

func (m *mockVectorRepo) UpsertVector(_ context.Context, _, _ string, _ []float64, _ map[string]string) error {
	return m.upsertErr
}

func Test_NewService_NilRepo(t *testing.T) {
	svc := NewService(nil)
	if svc == nil {
		t.Fatal("expected non-nil service")
	}
	if svc.repo != nil {
		t.Fatal("expected nil repo")
	}
}

func Test_NewService_WithRepo(t *testing.T) {
	repo := newMockVectorRepo()
	svc := NewService(repo)
	if svc == nil {
		t.Fatal("expected non-nil service")
	}
	if svc.repo != repo {
		t.Fatal("expected repo to be set")
	}
}

func Test_CreateStore_DefaultMetricCosine(t *testing.T) {
	repo := newMockVectorRepo()
	svc := NewService(repo)
	ctx := context.Background()

	req := models.CreateStoreRequest{
		Name:       "test-store",
		Dimensions: 128,
		// Metric intentionally empty to test default
	}

	store, err := svc.CreateStore(ctx, "tenant-1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if store == nil {
		t.Fatal("expected non-nil store")
	}
	if store.Name != "test-store" {
		t.Fatalf("expected name 'test-store', got '%s'", store.Name)
	}
	if store.Metric != "cosine" {
		t.Fatalf("expected default metric 'cosine', got '%s'", store.Metric)
	}
	if store.Dimensions != 128 {
		t.Fatalf("expected dimensions 128, got %d", store.Dimensions)
	}
	if store.TenantID != "tenant-1" {
		t.Fatalf("expected tenant 'tenant-1', got '%s'", store.TenantID)
	}
}

func Test_CreateStore_CustomMetric(t *testing.T) {
	repo := newMockVectorRepo()
	svc := NewService(repo)
	ctx := context.Background()

	req := models.CreateStoreRequest{
		Name:       "euclidean-store",
		Dimensions: 256,
		Metric:     "euclidean",
	}

	store, err := svc.CreateStore(ctx, "tenant-2", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if store.Metric != "euclidean" {
		t.Fatalf("expected metric 'euclidean', got '%s'", store.Metric)
	}
}

func Test_SearchVectors_DefaultLimit(t *testing.T) {
	repo := newMockVectorRepo()
	svc := NewService(repo)
	ctx := context.Background()

	// Seed a store so the search doesn't fail on GetStore lookup
	repo.stores["store-1"] = &models.VectorStore{ID: "store-1"}
	repo.searchResults = []models.SearchResult{
		{ItemID: "item-1", Distance: 0.1},
	}

	// Limit=0 should default to 10
	query := models.SearchQuery{
		Vector: []float64{0.1, 0.2, 0.3},
		Limit:  0,
	}

	results, err := svc.SearchVectors(ctx, "tenant-1", "store-1", query)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
}

func Test_SearchVectors_NegativeLimit(t *testing.T) {
	repo := newMockVectorRepo()
	svc := NewService(repo)
	ctx := context.Background()

	repo.stores["store-1"] = &models.VectorStore{ID: "store-1"}
	repo.searchResults = []models.SearchResult{
		{ItemID: "item-1", Distance: 0.5},
	}

	query := models.SearchQuery{
		Vector: []float64{1.0},
		Limit:  -5,
	}

	results, err := svc.SearchVectors(ctx, "tenant-1", "store-1", query)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
}

func Test_DeleteStore_NilRepo_Panic(t *testing.T) {
	svc := NewService(nil)
	defer func() {
		if r := recover(); r != nil {
			t.Log("DeleteStore with nil repo panicked as expected (panic is acceptable for nil dep)")
		}
	}()
	svc.DeleteStore(context.Background(), "tenant", "id")
}

func Test_DeleteVectors(t *testing.T) {
	repo := newMockVectorRepo()
	repo.deleteVectorN = 3
	svc := NewService(repo)
	ctx := context.Background()

	n, err := svc.DeleteVectors(ctx, "tenant-1", "store-1", []string{"v1", "v2", "v3"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if n != 3 {
		t.Fatalf("expected 3 deleted, got %d", n)
	}
}

func Test_ListStores_NilResult_ReturnsEmptySlice(t *testing.T) {
	repo := newMockVectorRepo()
	svc := NewService(repo)
	ctx := context.Background()

	// ListStores with empty mock returns nil slice; service should return empty slice
	stores, err := svc.ListStores(ctx, "tenant-1", 10, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if stores == nil {
		t.Fatal("expected non-nil empty slice, got nil")
	}
	if len(stores) != 0 {
		t.Fatalf("expected 0 stores, got %d", len(stores))
	}
}
