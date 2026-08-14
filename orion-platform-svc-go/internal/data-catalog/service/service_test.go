package service_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/data-catalog/models"
	dcrepo "orion/platform-svc-go/internal/data-catalog/repository"
	"orion/platform-svc-go/internal/data-catalog/service"
)

// ---------------------------------------------------------------------------
// fakeCatalogRepo  —  a record-and-return fake for service.RepositoryInterface.
// ---------------------------------------------------------------------------

type fakeCatalogRepo struct {
	// staged results
	listResult    []models.Entry
	listErr       error
	getByIDResult *models.Entry
	getByIDErr   error
	createResult  *models.Entry
	createErr     error
	updateResult  *models.Entry
	updateErr     error
	deleteErr     error
	searchResult  []models.Entry
	searchErr     error
	countResult   int
	countErr      error
	getByTableRes []models.Entry
	getByTableErr error

	// recorded calls
	createCalls  []struct{ tenant string; req models.CreateEntryRequest }
	getByIDCalls []struct{ tenant, id string }
	listCalls    []string
	updateCalls  []struct{ tenant, id string; req models.UpdateEntryRequest }
	deleteCalls  []struct{ tenant, id string }
}

var _ service.RepositoryInterface = (*fakeCatalogRepo)(nil)
var _ dcrepo.RepositoryInterface = (*fakeCatalogRepo)(nil)

func (f *fakeCatalogRepo) List(ctx context.Context, tenantID string) ([]models.Entry, error) {
	f.listCalls = append(f.listCalls, tenantID)
	return f.listResult, f.listErr
}

func (f *fakeCatalogRepo) GetByID(ctx context.Context, tenantID, id string) (*models.Entry, error) {
	f.getByIDCalls = append(f.getByIDCalls, struct{ tenant, id string }{tenantID, id})
	return f.getByIDResult, f.getByIDErr
}

func (f *fakeCatalogRepo) Create(ctx context.Context, tenantID string, req models.CreateEntryRequest) (*models.Entry, error) {
	f.createCalls = append(f.createCalls, struct{ tenant string; req models.CreateEntryRequest }{tenantID, req})
	return f.createResult, f.createErr
}

func (f *fakeCatalogRepo) Update(ctx context.Context, tenantID, id string, req models.UpdateEntryRequest) (*models.Entry, error) {
	f.updateCalls = append(f.updateCalls, struct{ tenant, id string; req models.UpdateEntryRequest }{tenantID, id, req})
	return f.updateResult, f.updateErr
}

func (f *fakeCatalogRepo) Delete(ctx context.Context, tenantID, id string) error {
	f.deleteCalls = append(f.deleteCalls, struct{ tenant, id string }{tenantID, id})
	return f.deleteErr
}

func (f *fakeCatalogRepo) Search(ctx context.Context, tenantID string, q models.SearchRequest) ([]models.Entry, error) {
	return f.searchResult, f.searchErr
}

func (f *fakeCatalogRepo) Count(ctx context.Context, tenantID string) (int, error) {
	return f.countResult, f.countErr
}

func (f *fakeCatalogRepo) GetByTable(ctx context.Context, tenantID, tableName string) ([]models.Entry, error) {
	return f.getByTableRes, f.getByTableErr
}

func (f *fakeCatalogRepo) CreateOrUpdateCatalogEntry(ctx context.Context, tenantID string, databaseName string, schema *models.DiscoveredSchema) (int, int, error) {
	return 0, 0, nil
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

var ctx = context.Background()

func sampleEntry() models.Entry {
	return models.Entry{
		ID:       "entry-1",
		TenantID: "tenant-a",
		Name:     "user_table",
		DataType: "table",
		TableName: "users",
	}
}

func sampleEntryPtr() *models.Entry {
	e := sampleEntry()
	return &e
}

func sampleCreateReq() models.CreateEntryRequest {
	return models.CreateEntryRequest{
		Name:      "user_table",
		DataType:  "table",
		TableName: "users",
	}
}

// ---------------------------------------------------------------------------
// NewService
// ---------------------------------------------------------------------------

func TestService_NewService(t *testing.T) {
	s := service.NewService(&fakeCatalogRepo{}, nil)
	if s == nil {
		t.Fatal("NewService returned nil")
	}
}

// ---------------------------------------------------------------------------
// CreateEntry
// ---------------------------------------------------------------------------

func TestService_CreateEntry_Success(t *testing.T) {
	repo := &fakeCatalogRepo{}
	entry := sampleEntry()
	repo.createResult = &entry
	s := service.NewService(repo, nil)

	got, err := s.CreateEntry(ctx, "tenant-a", sampleCreateReq())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != "entry-1" {
		t.Fatalf("expected entry ID entry-1, got %s", got.ID)
	}
	if len(repo.createCalls) != 1 {
		t.Fatalf("expected 1 Create call, got %d", len(repo.createCalls))
	}
	if repo.createCalls[0].tenant != "tenant-a" {
		t.Fatalf("expected tenant tenant-a, got %s", repo.createCalls[0].tenant)
	}
	if repo.createCalls[0].req.Name != "user_table" {
		t.Fatalf("expected req name user_table, got %s", repo.createCalls[0].req.Name)
	}
}

func TestService_CreateEntry_MissingName(t *testing.T) {
	repo := &fakeCatalogRepo{}
	s := service.NewService(repo, nil)

	req := sampleCreateReq()
	req.Name = ""
	_, err := s.CreateEntry(ctx, "tenant-a", req)
	if err == nil {
		t.Fatal("expected error for empty name, got nil")
	}
	if !strings.Contains(err.Error(), "name") {
		t.Fatalf("expected error mentioning 'name', got: %v", err)
	}
	if len(repo.createCalls) != 0 {
		t.Fatal("repo.Create must not be called when validation fails")
	}
}

func TestService_CreateEntry_MissingDataType(t *testing.T) {
	repo := &fakeCatalogRepo{}
	s := service.NewService(repo, nil)

	req := sampleCreateReq()
	req.DataType = ""
	_, err := s.CreateEntry(ctx, "tenant-a", req)
	if err == nil {
		t.Fatal("expected error for empty dataType")
	}
	if !strings.Contains(err.Error(), "dataType") {
		t.Fatalf("expected error mentioning 'dataType', got: %v", err)
	}
}

func TestService_CreateEntry_MissingTableName(t *testing.T) {
	repo := &fakeCatalogRepo{}
	s := service.NewService(repo, nil)

	req := sampleCreateReq()
	req.TableName = ""
	_, err := s.CreateEntry(ctx, "tenant-a", req)
	if err == nil {
		t.Fatal("expected error for empty tableName")
	}
	if !strings.Contains(err.Error(), "tableName") {
		t.Fatalf("expected error mentioning 'tableName', got: %v", err)
	}
}

func TestService_CreateEntry_RepoError(t *testing.T) {
	repo := &fakeCatalogRepo{createErr: errors.New("db down")}
	s := service.NewService(repo, nil)

	_, err := s.CreateEntry(ctx, "tenant-a", sampleCreateReq())
	if err == nil {
		t.Fatal("expected error from repo")
	}
	if !strings.Contains(err.Error(), "create catalog entry") {
		t.Fatalf("expected wrapped error, got: %v", err)
	}
	if !strings.Contains(err.Error(), "db down") {
		t.Fatalf("expected wrapped error to contain 'db down', got: %v", err)
	}
}

// ---------------------------------------------------------------------------
// GetEntry
// ---------------------------------------------------------------------------

func TestService_GetEntry_Success(t *testing.T) {
	repo := &fakeCatalogRepo{}
	repo.getByIDResult = sampleEntryPtr()
	s := service.NewService(repo, nil)

	got, err := s.GetEntry(ctx, "tenant-a", "entry-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != "entry-1" {
		t.Fatalf("expected ID entry-1, got %s", got.ID)
	}
	if len(repo.getByIDCalls) != 1 {
		t.Fatalf("expected 1 GetByID call, got %d", len(repo.getByIDCalls))
	}
}

func TestService_GetEntry_NotFound(t *testing.T) {
	repo := &fakeCatalogRepo{getByIDErr: errors.New("not found")}
	s := service.NewService(repo, nil)

	_, err := s.GetEntry(ctx, "tenant-a", "no-such")
	if err == nil {
		t.Fatal("expected error")
	}
	if !service.IsNotFound(err) {
		t.Fatalf("expected NotFound error, got: %v", err)
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Fatalf("expected error to mention 'not found', got: %v", err)
	}
}

// ---------------------------------------------------------------------------
// ListEntries
// ---------------------------------------------------------------------------

func TestService_ListEntries_Success(t *testing.T) {
	entries := []models.Entry{{ID: "a"}, {ID: "b"}}
	repo := &fakeCatalogRepo{listResult: entries}
	s := service.NewService(repo, nil)

	got, err := s.ListEntries(ctx, "tenant-a")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(got))
	}
	if got[0].ID != "a" || got[1].ID != "b" {
		t.Fatalf("unexpected entries: %v", got)
	}
	if len(repo.listCalls) != 1 || repo.listCalls[0] != "tenant-a" {
		t.Fatalf("unexpected list calls: %v", repo.listCalls)
	}
}

func TestService_ListEntries_Empty(t *testing.T) {
	repo := &fakeCatalogRepo{listResult: nil}
	s := service.NewService(repo, nil)

	got, err := s.ListEntries(ctx, "tenant-a")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil, got %d entries", len(got))
	}
}

func TestService_ListEntries_RepoError(t *testing.T) {
	repo := &fakeCatalogRepo{listErr: errors.New("db down")}
	s := service.NewService(repo, nil)

	_, err := s.ListEntries(ctx, "tenant-a")
	if err == nil {
		t.Fatal("expected error from repo")
	}
}

// ---------------------------------------------------------------------------
// UpdateEntry
// ---------------------------------------------------------------------------

func TestService_UpdateEntry_Success(t *testing.T) {
	entry := sampleEntry()
	repo := &fakeCatalogRepo{
		getByIDResult: &entry,
		updateResult:  &entry,
	}
	s := service.NewService(repo, nil)

	updated, err := s.UpdateEntry(ctx, "tenant-a", "entry-1", models.UpdateEntryRequest{
		Description: "updated desc",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.ID != "entry-1" {
		t.Fatalf("expected ID entry-1, got %s", updated.ID)
	}
	if len(repo.updateCalls) != 1 {
		t.Fatalf("expected 1 Update call, got %d", len(repo.updateCalls))
	}
	if repo.updateCalls[0].id != "entry-1" {
		t.Fatalf("expected update id entry-1, got %s", repo.updateCalls[0].id)
	}
}

func TestService_UpdateEntry_NotFound(t *testing.T) {
	repo := &fakeCatalogRepo{getByIDErr: errors.New("not found")}
	s := service.NewService(repo, nil)

	_, err := s.UpdateEntry(ctx, "tenant-a", "no-such", models.UpdateEntryRequest{})
	if err == nil {
		t.Fatal("expected error")
	}
	if !service.IsNotFound(err) {
		t.Fatalf("expected NotFound error, got: %v", err)
	}
	if len(repo.updateCalls) != 0 {
		t.Fatal("repo.Update must not be called when entry is not found")
	}
}

func TestService_UpdateEntry_RepoUpdateError(t *testing.T) {
	entry := sampleEntry()
	repo := &fakeCatalogRepo{
		getByIDResult: &entry,
		updateErr:     errors.New("update failed"),
	}
	s := service.NewService(repo, nil)

	_, err := s.UpdateEntry(ctx, "tenant-a", "entry-1", models.UpdateEntryRequest{})
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "update catalog entry") {
		t.Fatalf("expected wrapped update error, got: %v", err)
	}
}

// ---------------------------------------------------------------------------
// DeleteEntry
// ---------------------------------------------------------------------------

func TestService_DeleteEntry_Success(t *testing.T) {
	repo := &fakeCatalogRepo{}
	s := service.NewService(repo, nil)

	err := s.DeleteEntry(ctx, "tenant-a", "entry-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(repo.deleteCalls) != 1 {
		t.Fatalf("expected 1 Delete call, got %d", len(repo.deleteCalls))
	}
	if repo.deleteCalls[0].tenant != "tenant-a" || repo.deleteCalls[0].id != "entry-1" {
		t.Fatalf("unexpected delete call: %v", repo.deleteCalls[0])
	}
}

func TestService_DeleteEntry_RepoError(t *testing.T) {
	repo := &fakeCatalogRepo{deleteErr: errors.New("db down")}
	s := service.NewService(repo, nil)

	err := s.DeleteEntry(ctx, "tenant-a", "entry-1")
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "delete catalog entry") {
		t.Fatalf("expected wrapped delete error, got: %v", err)
	}
}

// ---------------------------------------------------------------------------
// SearchEntries
// ---------------------------------------------------------------------------

func TestService_SearchEntries_Success(t *testing.T) {
	entries := []models.Entry{{ID: "a"}, {ID: "b"}}
	repo := &fakeCatalogRepo{
		searchResult: entries,
		countResult:  2,
	}
	s := service.NewService(repo, nil)

	q := models.SearchRequest{Query: "user", Page: 1, Limit: 10}
	resp, err := s.SearchEntries(ctx, "tenant-a", q)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Data) != 2 {
		t.Fatalf("expected 2 data items, got %d", len(resp.Data))
	}
	if resp.Total != 2 {
		t.Fatalf("expected total 2, got %d", resp.Total)
	}
	if resp.Page != 1 || resp.Limit != 10 {
		t.Fatalf("unexpected pagination: page=%d limit=%d", resp.Page, resp.Limit)
	}
}

func TestService_SearchEntries_CountError(t *testing.T) {
	entries := []models.Entry{{ID: "a"}}
	repo := &fakeCatalogRepo{
		searchResult: entries,
		countErr:     errors.New("count failed"),
	}
	s := service.NewService(repo, nil)

	resp, err := s.SearchEntries(ctx, "tenant-a", models.SearchRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// When count fails, total defaults to 0
	if resp.Total != 0 {
		t.Fatalf("expected total 0 when count errors, got %d", resp.Total)
	}
}

// ---------------------------------------------------------------------------
// GetEntriesByTable
// ---------------------------------------------------------------------------

func TestService_GetEntriesByTable_Success(t *testing.T) {
	entries := []models.Entry{{TableName: "users"}, {TableName: "users"}}
	repo := &fakeCatalogRepo{getByTableRes: entries}
	s := service.NewService(repo, nil)

	got, err := s.GetEntriesByTable(ctx, "tenant-a", "users")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(got))
	}
}

// ---------------------------------------------------------------------------
// Discover — basic paths (no introspector)
// ---------------------------------------------------------------------------

func TestService_Discover_NilIntrospector(t *testing.T) {
	s := service.NewService(&fakeCatalogRepo{}, nil)

	summary := s.Discover(ctx, "tenant-a")
	if summary == nil {
		t.Fatal("expected non-nil summary")
	}
	if summary.Status != "skipped" {
		t.Fatalf("expected status 'skipped', got %q", summary.Status)
	}
	if !strings.Contains(summary.Message, "introspector not configured") {
		t.Fatalf("unexpected message: %q", summary.Message)
	}
}

// ---------------------------------------------------------------------------
// sentinel / error helpers
// ---------------------------------------------------------------------------

func TestService_IsNotFound(t *testing.T) {
	err := service.ErrNotFoundEntry("x")
	if !service.IsNotFound(err) {
		t.Fatal("expected IsNotFound=true for ErrNotFoundEntry")
	}
}

func TestService_IsNotFound_False(t *testing.T) {
	if service.IsNotFound(errors.New("something else")) {
		t.Fatal("expected IsNotFound=false")
	}
}

// ---------------------------------------------------------------------------
// Ensure sentinel.NotFound is reachable (integration sanity check)
// ---------------------------------------------------------------------------

func TestService_SentinelNotFoundReachable(t *testing.T) {
	if sentinel.NotFound == nil {
		t.Fatal("sentinel.NotFound must not be nil")
	}
}
