package service

import (
	"context"
	"database/sql"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"

	"orion/platform-svc-go/internal/apm/models"
)

// fakeRepo implements RepositoryInterface for service tests.
type fakeRepo struct{}

func (r *fakeRepo) Create(ctx context.Context, entity *models.ApmEntry) error     { return nil }
func (r *fakeRepo) Delete(ctx context.Context, id, tenantID string) (bool, error) { return false, nil }
func (r *fakeRepo) GetByID(ctx context.Context, id, tenantID string) (*models.ApmEntry, error) {
	return nil, nil
}
func (r *fakeRepo) List(ctx context.Context, tenantID string) ([]models.ApmEntry, error) {
	return []models.ApmEntry{}, nil
}
func (r *fakeRepo) Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ApmEntry, error) {
	return nil, nil
}

var _ RepositoryInterface = (*fakeRepo)(nil)

func TestService_New(t *testing.T) {
	svc := NewService(&fakeRepo{}, nil)
	if svc == nil {
		t.Fatal("expected non-nil service")
	}
	if svc.repo == nil {
		t.Error("expected non-nil repo")
	}
}

func TestService_Create(t *testing.T) {
	svc := NewService(&fakeRepo{}, nil)
	ctx := context.Background()
	entry, err := svc.Create(ctx, &models.CreateRequest{Name: "test-app"}, "tenant-1")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if entry == nil {
		t.Fatal("expected non-nil entry")
	}
	if entry.TenantID != "tenant-1" {
		t.Errorf("TenantID = %q, want %q", entry.TenantID, "tenant-1")
	}
	if entry.Name != "test-app" {
		t.Errorf("Name = %q, want %q", entry.Name, "test-app")
	}
}

func TestService_List(t *testing.T) {
	svc := NewService(&fakeRepo{}, nil)
	entries, err := svc.List(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if entries == nil {
		t.Error("expected non-nil entries slice")
	}
}

func TestService_Delete(t *testing.T) {
	svc := NewService(&fakeRepo{}, nil)
	deleted, err := svc.Delete(context.Background(), "some-id", "tenant-1")
	if err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if deleted {
		t.Error("expected false for non-existent entry")
	}
}

// --- Slow Query Collection Tests ---

func TestGetSlowQueries_NoDB(t *testing.T) {
	// When db is nil, GetSlowQueries returns empty results without error.
	svc := NewService(&fakeRepo{}, nil)
	ctx := context.Background()
	result, err := svc.GetSlowQueries(ctx, "tenant-1", nil)
	if err != nil {
		t.Fatalf("GetSlowQueries with nil db: %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.Total != 0 {
		t.Errorf("Total = %d, want 0", result.Total)
	}
	if len(result.Queries) != 0 {
		t.Errorf("len(Queries) = %d, want 0", len(result.Queries))
	}
}

func TestGetSlowQueries_NilQueryFilter(t *testing.T) {
	svc := NewService(&fakeRepo{}, nil)
	ctx := context.Background()
	result, err := svc.GetSlowQueries(ctx, "tenant-1", nil)
	if err != nil {
		t.Fatalf("GetSlowQueries(nil): %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
}

func TestGetSlowQueries_FilterParamsIgnoredWhenNoDB(t *testing.T) {
	svc := NewService(&fakeRepo{}, nil)
	ctx := context.Background()

	// All filter combinations should return empty when db is nil.
	testCases := []struct {
		name string
		q    *models.SlowQueriesQuery
	}{
		{"nil filter", nil},
		{"min duration", &models.SlowQueriesQuery{MinDurationMs: 100}},
		{"database", &models.SlowQueriesQuery{Database: "orion-db"}},
		{"limit", &models.SlowQueriesQuery{Limit: 5}},
		{"all filters", &models.SlowQueriesQuery{MinDurationMs: 100, Database: "orion-db", Limit: 10}},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := svc.GetSlowQueries(ctx, "tenant-1", tc.q)
			if err != nil {
				t.Fatalf("GetSlowQueries: %v", err)
			}
			if result.Total != 0 {
				t.Errorf("Total = %d, want 0", result.Total)
			}
		})
	}
}

func TestLimitArgOffset(t *testing.T) {
	testCases := []struct {
		name     string
		q        *models.SlowQueriesQuery
		expected int
	}{
		{"nil query", nil, 1},
		{"min duration only", &models.SlowQueriesQuery{MinDurationMs: 100}, 2},
		{"database only", &models.SlowQueriesQuery{Database: "db"}, 2},
		{"both filters", &models.SlowQueriesQuery{MinDurationMs: 100, Database: "db"}, 3},
		{"limit only", &models.SlowQueriesQuery{Limit: 10}, 1},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got := limitArgOffset(tc.q)
			if got != tc.expected {
				t.Errorf("limitArgOffset(%v) = %d, want %d", tc.q, got, tc.expected)
			}
		})
	}
}

func TestGetSlowQueries_WithRealSQLConnection_FailsGracefully(t *testing.T) {
	// Open a connection to a non-existent host. The query will fail,
	// but GetSlowQueries should return empty results without error.
	db, err := sql.Open("pgx", "host=localhost port=1 dbname=nonexistent sslmode=disable")
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	defer db.Close()

	svc := NewService(&fakeRepo{}, db)
	ctx := context.Background()
	result, err := svc.GetSlowQueries(ctx, "tenant-1", nil)
	if err != nil {
		t.Fatalf("GetSlowQueries should not error when DB is unreachable: %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
	if result.Total != 0 {
		t.Errorf("Total = %d, want 0", result.Total)
	}
}
