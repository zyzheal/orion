package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/cmdb/models"
)

// mockRepo implements RepositoryInterface for service-layer tests.
type mockRepo struct {
	err        error
	query      string
	ciType     string
	tenantID   string
	domain     string
	limit      int
	offset     int
	cis        []models.CI
	calledArgs searchArgs
}

type searchArgs struct {
	tenantID string
	query    string
	domain   string
	limit    int
	offset   int
}

func (m *mockRepo) BatchCreateCIs(ctx context.Context, items []models.BatchCreateItem, tenantID string, createdBy string) (*models.BatchResult, error) { return nil, nil }
func (m *mockRepo) BatchDeleteCIs(ctx context.Context, ids []string, tenantID string) (*models.BatchResult, error) { return nil, nil }
func (m *mockRepo) BatchQueryCIs(ctx context.Context, q *models.BatchQueryRequest, tenantID string) ([]models.CI, int, error) { return nil, 0, nil }
func (m *mockRepo) BatchUpdateCIs(ctx context.Context, items []models.BatchUpdateItem, tenantID string) (*models.BatchResult, error) { return nil, nil }
func (m *mockRepo) CreateCI(ctx context.Context, ci *models.CI) error { return nil }
func (m *mockRepo) CreateRelation(ctx context.Context, rel *models.CIRelation) error { return nil }
func (m *mockRepo) CreateVersion(ctx context.Context, ciID string, version int, snapshot *string, createdBy string, tenantID string) error { return nil }
func (m *mockRepo) DeleteCI(ctx context.Context, id string) (bool, error) { return false, nil }
func (m *mockRepo) DeleteRelation(ctx context.Context, relationID string, tenantID string) (bool, error) { return false, nil }
func (m *mockRepo) ExportCIs(ctx context.Context, ciType, status, environment, search *string, tenantID string, includeArchived bool) ([]models.CI, error) { return nil, nil }
func (m *mockRepo) GetCIByCiId(ctx context.Context, ciID string, tenantID *string) (*models.CI, error) { return nil, nil }
func (m *mockRepo) GetCIByID(ctx context.Context, id string) (*models.CI, error) { return nil, nil }
func (m *mockRepo) GetCIRelations(ctx context.Context, ciID string) ([]models.CIRelation, error) { return nil, nil }
func (m *mockRepo) GetCIVersions(ctx context.Context, ciID string) ([]models.CIVersion, error) { return nil, nil }
func (m *mockRepo) GetCurrentVersion(ctx context.Context, ciID string) (*models.CIVersion, error) { return nil, nil }
func (m *mockRepo) GetImpactAnalysis(ctx context.Context, tenantID string, ciID string) ([]models.CIRelation, error) { return nil, nil }
func (m *mockRepo) GetServiceDependencies(ctx context.Context, tenantID string, ciID string) ([]models.CIRelation, error) { return nil, nil }
func (m *mockRepo) GetTopologyEdges(ctx context.Context, tenantID string, limit int) ([]models.TopologyEdge, error) { return nil, nil }
func (m *mockRepo) GetTopologyNodes(ctx context.Context, ciType *string, tenantID string, limit int) ([]models.TopologyNode, error) { return nil, nil }
func (m *mockRepo) GetVersionSnapshot(ctx context.Context, ciID string, version int) (*string, error) { return nil, nil }
func (m *mockRepo) ListCIs(ctx context.Context, ciType *string, status *string, tenantID string, page, limit int) ([]models.CI, int, error) { return nil, 0, nil }
func (m *mockRepo) UpdateCI(ctx context.Context, id string, updates map[string]interface{}) (*models.CI, error) { return nil, nil }

func (m *mockRepo) SearchCIs(ctx context.Context, tenantID, query, domain string, limit, offset int) ([]models.CI, error) {
	m.calledArgs = searchArgs{tenantID: tenantID, query: query, domain: domain, limit: limit, offset: offset}
	return m.cis, m.err
}

func helperCI(id, name, ciType, tenantID string) models.CI {
	return models.CI{
		ID:       id,
		CIID:     "ci-" + id,
		Name:     name,
		CIType:   ciType,
		Status:   "active",
		TenantID: tenantID,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
}

func makeService(repo RepositoryInterface) *Service {
	return NewService(repo)
}

// --- Tests ---

func TestService_Search_DefaultTenantID(t *testing.T) {
	m := &mockRepo{cis: []models.CI{helperCI("1", "Web Server", "Server", "default")}}
	svc := makeService(m)
	ctx := context.Background()

	items, err := svc.Search(ctx, "", "web", "")
	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}
	if m.calledArgs.tenantID != "00000000-0000-0000-0000-000000000000" {
		t.Errorf("expected default tenant ID, got %q", m.calledArgs.tenantID)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 result, got %d", len(items))
	}
}

func TestService_Search_CustomTenantID(t *testing.T) {
	m := &mockRepo{cis: []models.CI{helperCI("1", "DB Server", "Database", "tenant-abc")}}
	svc := makeService(m)
	ctx := context.Background()

	tenantID := "tenant-abc"
	items, err := svc.Search(ctx, tenantID, "db", "")
	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}
	if m.calledArgs.tenantID != "tenant-abc" {
		t.Errorf("expected tenantID %q, got %q", "tenant-abc", m.calledArgs.tenantID)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 result, got %d", len(items))
	}
}

func TestService_Search_QueryPassedThrough(t *testing.T) {
	m := &mockRepo{cis: []models.CI{helperCI("1", "Monitor", "Monitoring", "t1")}}
	svc := makeService(m)
	ctx := context.Background()

	_, err := svc.Search(ctx, "t1", "monitoring", "")
	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}
	if m.calledArgs.query != "monitoring" {
		t.Errorf("expected query %q, got %q", "monitoring", m.calledArgs.query)
	}
}

func TestService_Search_DomainPassedThrough(t *testing.T) {
	m := &mockRepo{cis: []models.CI{helperCI("1", "App", "Application", "t1")}}
	svc := makeService(m)
	ctx := context.Background()

	_, err := svc.Search(ctx, "t1", "app", "Application")
	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}
	if m.calledArgs.domain != "Application" {
		t.Errorf("expected domain %q, got %q", "Application", m.calledArgs.domain)
	}
}

func TestService_Search_DefaultLimitAndOffset(t *testing.T) {
	m := &mockRepo{cis: []models.CI{helperCI("1", "Host", "Host", "t1")}}
	svc := makeService(m)
	ctx := context.Background()

	_, err := svc.Search(ctx, "t1", "host", "")
	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}
	if m.calledArgs.limit != 20 {
		t.Errorf("expected default limit 20, got %d", m.calledArgs.limit)
	}
	if m.calledArgs.offset != 0 {
		t.Errorf("expected default offset 0, got %d", m.calledArgs.offset)
	}
}

func TestService_Search_MultipleResults(t *testing.T) {
	cis := []models.CI{
		helperCI("1", "Web-1", "Server", "t1"),
		helperCI("2", "Web-2", "Server", "t1"),
		helperCI("3", "Web-3", "Server", "t1"),
	}
	m := &mockRepo{cis: cis}
	svc := makeService(m)
	ctx := context.Background()

	items, err := svc.Search(ctx, "t1", "web", "")
	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}
	if len(items) != 3 {
		t.Fatalf("expected 3 results, got %d", len(items))
	}
}

func TestService_Search_NoResults(t *testing.T) {
	m := &mockRepo{cis: []models.CI{}}
	svc := makeService(m)
	ctx := context.Background()

	items, err := svc.Search(ctx, "t1", "zzz", "")
	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("expected 0 results, got %d", len(items))
	}
}

func TestService_Search_EmptyQuery(t *testing.T) {
	m := &mockRepo{cis: []models.CI{helperCI("1", "Web", "Server", "t1")}}
	svc := makeService(m)
	ctx := context.Background()

	items, err := svc.Search(ctx, "t1", "", "")
	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}
	if m.calledArgs.query != "" {
		t.Errorf("expected empty query, got %q", m.calledArgs.query)
	}
	if len(items) != 1 {
		t.Fatalf("expected repo result, got %d", len(items))
	}
}

func TestService_Search_RepositoryError(t *testing.T) {
	expectedErr := errors.New("connection refused")
	m := &mockRepo{err: expectedErr}
	svc := makeService(m)
	ctx := context.Background()

	_, err := svc.Search(ctx, "t1", "test", "")
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if err != expectedErr {
		t.Errorf("expected wrapped error, got %v", err)
	}
}

func TestService_Search_ContextPropagated(t *testing.T) {
	m := &mockRepo{cis: []models.CI{helperCI("1", "Test", "Test", "t1")}}
	svc := makeService(m)
	ctx := context.Background()

	_, err := svc.Search(ctx, "t1", "test", "")
	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}
	// If we got here the call succeeded; verify args were forwarded.
	if m.calledArgs.tenantID != "t1" || m.calledArgs.query != "test" {
		t.Errorf("args not propagated correctly: %+v", m.calledArgs)
	}
}

func TestService_Search_ContextCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	svc := makeService(&mockRepo{err: context.Canceled})

	_, err := svc.Search(ctx, "t1", "test", "")
	// The mock returns the error directly (not from ctx) but we verify
	// that context cancellation is accepted by the service layer.
	if err == nil {
		t.Fatalf("expected error on canceled context, got nil")
	}
}

func TestService_Search_EmptyDomain(t *testing.T) {
	m := &mockRepo{cis: []models.CI{helperCI("1", "Server", "Server", "t1")}}
	svc := makeService(m)
	ctx := context.Background()

	_, err := svc.Search(ctx, "t1", "server", "")
	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}
	if m.calledArgs.domain != "" {
		t.Errorf("expected empty domain, got %q", m.calledArgs.domain)
	}
}

func TestService_Search_PassThroughToRepository(t *testing.T) {
	// Ensure that the Service.Search method faithfully passes all parameters
	// to the repository's SearchCIs method without modifying them.
	m := &mockRepo{cis: []models.CI{helperCI("1", "Node", "Host", "tenant-42")}}
	svc := makeService(m)
	ctx := context.Background()

	_, err := svc.Search(ctx, "tenant-42", "node", "Host")
	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}
	if m.calledArgs.tenantID != "tenant-42" {
		t.Errorf("tenantID mismatch: got %q", m.calledArgs.tenantID)
	}
	if m.calledArgs.query != "node" {
		t.Errorf("query mismatch: got %q", m.calledArgs.query)
	}
	if m.calledArgs.domain != "Host" {
		t.Errorf("domain mismatch: got %q", m.calledArgs.domain)
	}
}
