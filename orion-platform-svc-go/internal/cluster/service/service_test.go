package service_test

import (
	"context"
	"fmt"
	"testing"

	"orion/platform-svc-go/internal/cluster/models"
	"orion/platform-svc-go/internal/cluster/service"
)

// --- Fake repository that returns fixed data ---

type fakeClusterRepo struct {
	clusters []*models.Cluster
}

func (f *fakeClusterRepo) Create(ctx context.Context, m *models.Cluster) error {
	f.clusters = append(f.clusters, m)
	return nil
}

func (f *fakeClusterRepo) GetByID(ctx context.Context, tenantID, id string) (*models.Cluster, error) {
	for _, c := range f.clusters {
		if c.TenantID == tenantID && c.ID == id {
			return c, nil
		}
	}
	return nil, fmt.Errorf("cluster not found: %s", id)
}

func (f *fakeClusterRepo) List(ctx context.Context, tenantID string) ([]models.Cluster, error) {
	result := make([]models.Cluster, 0)
	for _, c := range f.clusters {
		if c.TenantID == tenantID {
			result = append(result, *c)
		}
	}
	return result, nil
}

func (f *fakeClusterRepo) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	return nil
}

func (f *fakeClusterRepo) Delete(ctx context.Context, tenantID, id string) error {
	for i, c := range f.clusters {
		if c.TenantID == tenantID && c.ID == id {
			f.clusters = append(f.clusters[:i], f.clusters[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("cluster not found: %s", id)
}

var _ service.RepositoryInterface = (*fakeClusterRepo)(nil)

func makeFakeRepo() *fakeClusterRepo {
	return &fakeClusterRepo{clusters: make([]*models.Cluster, 0)}
}

// --- Tests ---

func TestService_NewService(t *testing.T) {
	s := service.NewService(makeFakeRepo())
	if s == nil {
		t.Fatal("NewService returned nil")
	}
}

func TestService_NewService_NilRepo(t *testing.T) {
	s := service.NewService((*fakeClusterRepo)(nil))
	if s == nil {
		t.Fatal("NewService returned nil")
	}
}

func TestService_CreateCluster(t *testing.T) {
	repo := makeFakeRepo()
	s := service.NewService(repo)
	ctx := context.Background()

	req := models.CreateClusterRequest{
		Name:        "test-cluster",
		APIEndpoint: "http://test:6443",
		CaCert:      "-----BEGIN CERT-----",
		Token:       "test-token",
	}

	result, err := s.CreateCluster(ctx, "tenant-1", req)
	if err != nil {
		t.Fatalf("CreateCluster returned error: %v", err)
	}
	if result == nil {
		t.Fatal("CreateCluster returned nil cluster")
	}
	if result.Name != "test-cluster" {
		t.Fatalf("expected Name=test-cluster, got %s", result.Name)
	}
	if result.TenantID != "tenant-1" {
		t.Fatalf("expected TenantID=tenant-1, got %s", result.TenantID)
	}
	if result.APIEndpoint != "http://test:6443" {
		t.Fatalf("expected APIEndpoint=http://test:6443, got %s", result.APIEndpoint)
	}
	if result.Token != "test-token" {
		t.Fatalf("expected Token=test-token, got %s", result.Token)
	}
	if result.CaCert != "-----BEGIN CERT-----" {
		t.Fatalf("expected CaCert=-----BEGIN CERT-----, got %s", result.CaCert)
	}

	// Verify it was stored in the repo
	if len(repo.clusters) != 1 {
		t.Fatalf("expected 1 cluster in repo, got %d", len(repo.clusters))
	}
}

func TestService_CreateCluster_NoToken(t *testing.T) {
	repo := makeFakeRepo()
	s := service.NewService(repo)
	ctx := context.Background()

	req := models.CreateClusterRequest{
		Name:        "minimal-cluster",
		APIEndpoint: "http://test:6443",
	}

	result, err := s.CreateCluster(ctx, "tenant-2", req)
	if err != nil {
		t.Fatalf("CreateCluster returned error: %v", err)
	}
	if result == nil {
		t.Fatal("CreateCluster returned nil")
	}
	if result.Token != "" {
		t.Fatalf("expected empty token, got %s", result.Token)
	}
}

func TestService_CreateCluster_RepoError(t *testing.T) {
	// Use a repo that always errors on Create
	repo := &erroringRepo{}
	s := service.NewService(repo)
	ctx := context.Background()

	req := models.CreateClusterRequest{
		Name:        "fail-cluster",
		APIEndpoint: "http://test:6443",
		Token:       "token",
	}

	_, err := s.CreateCluster(ctx, "tenant-1", req)
	if err == nil {
		t.Fatal("expected error from CreateCluster, got nil")
	}
}

func TestService_GetCluster_Exists(t *testing.T) {
	repo := makeFakeRepo()
	s := service.NewService(repo)
	ctx := context.Background()

	// Pre-populate a cluster
	req := models.CreateClusterRequest{
		Name:        "existing",
		APIEndpoint: "http://existing:6443",
		Token:       "tok",
	}
	created, err := s.CreateCluster(ctx, "tenant-1", req)
	if err != nil {
		t.Fatalf("setup CreateCluster error: %v", err)
	}
	if created == nil {
		t.Fatal("setup: created cluster is nil")
	}
	created.ID = "cluster-1"

	result, err := s.GetCluster(ctx, "tenant-1", "cluster-1")
	if err != nil {
		t.Fatalf("GetCluster returned error: %v", err)
	}
	if result == nil {
		t.Fatal("GetCluster returned nil")
	}
	if result.Name != "existing" {
		t.Fatalf("expected Name=existing, got %s", result.Name)
	}
}

func TestService_GetCluster_NotFound(t *testing.T) {
	repo := makeFakeRepo()
	s := service.NewService(repo)
	ctx := context.Background()

	_, err := s.GetCluster(ctx, "tenant-1", "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent cluster, got nil")
	}
}

func TestService_ListClusters(t *testing.T) {
	repo := makeFakeRepo()
	s := service.NewService(repo)
	ctx := context.Background()

	// Create two clusters for tenant-1, one for tenant-2
	s.CreateCluster(ctx, "tenant-1", models.CreateClusterRequest{Name: "c1", APIEndpoint: "http://a", Token: "t"})
	s.CreateCluster(ctx, "tenant-1", models.CreateClusterRequest{Name: "c2", APIEndpoint: "http://b", Token: "t"})
	s.CreateCluster(ctx, "tenant-2", models.CreateClusterRequest{Name: "c3", APIEndpoint: "http://c", Token: "t"})

	results, err := s.ListClusters(ctx, "tenant-1")
	if err != nil {
		t.Fatalf("ListClusters returned error: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("expected 2 clusters for tenant-1, got %d", len(results))
	}
	if results[0].Name != "c1" {
		t.Fatalf("expected first cluster name=c1, got %s", results[0].Name)
	}

	// Other tenant
	results2, err := s.ListClusters(ctx, "tenant-2")
	if err != nil {
		t.Fatalf("ListClusters returned error: %v", err)
	}
	if len(results2) != 1 {
		t.Fatalf("expected 1 cluster for tenant-2, got %d", len(results2))
	}
}

func TestService_ListClusters_EmptyTenant(t *testing.T) {
	repo := makeFakeRepo()
	s := service.NewService(repo)
	ctx := context.Background()

	results, err := s.ListClusters(ctx, "nonexistent-tenant")
	if err != nil {
		t.Fatalf("ListClusters returned error: %v", err)
	}
	if len(results) != 0 {
		t.Fatalf("expected 0 clusters, got %d", len(results))
	}
}

func TestService_DeleteCluster(t *testing.T) {
	repo := makeFakeRepo()
	s := service.NewService(repo)
	ctx := context.Background()

	// Create a cluster
	req := models.CreateClusterRequest{
		Name:        "to-delete",
		APIEndpoint: "http://del:6443",
		Token:       "tok",
	}
	created, err := s.CreateCluster(ctx, "tenant-1", req)
	if err != nil {
		t.Fatalf("setup error: %v", err)
	}
	created.ID = "cluster-del"

	err = s.DeleteCluster(ctx, "tenant-1", "cluster-del")
	if err != nil {
		t.Fatalf("DeleteCluster returned error: %v", err)
	}

	// Verify it is gone
	_, err = s.GetCluster(ctx, "tenant-1", "cluster-del")
	if err == nil {
		t.Fatal("expected error after delete, cluster still found")
	}
}

func TestService_DeleteCluster_NotFound(t *testing.T) {
	repo := makeFakeRepo()
	s := service.NewService(repo)
	ctx := context.Background()

	err := s.DeleteCluster(ctx, "tenant-1", "nonexistent")
	if err == nil {
		t.Fatal("expected error deleting nonexistent cluster, got nil")
	}
}

// erroringRepo always returns an error on Create, useful for negative-path tests.
type erroringRepo struct{}

func (e *erroringRepo) Create(ctx context.Context, m *models.Cluster) error {
	return fmt.Errorf("simulated db error")
}
func (e *erroringRepo) GetByID(ctx context.Context, tenantID, id string) (*models.Cluster, error) {
	return nil, nil
}
func (e *erroringRepo) List(ctx context.Context, tenantID string) ([]models.Cluster, error) {
	return nil, nil
}
func (e *erroringRepo) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	return nil
}
func (e *erroringRepo) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}
