package service_test

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/storage/models"
	"orion/platform-svc-go/internal/storage/service"
)

// fakeStorageRepo implements service.RepositoryInterface for unit testing.
type fakeStorageRepo struct {
	createErr     error
	getByIDResult *models.StorageEntry
	getByIDErr    error
	getByBKErr    error
	getByBKResult *models.StorageEntry
	listResult    []models.StorageEntry
	listErr       error
	updateResult  *models.StorageEntry
	updateErr     error
	deleteResult  bool
	deleteErr     error
	deleteByBK    bool
	deleteByBKErr error

	lastCreate     *models.StorageEntry
	lastGetID      string
	lastGetTenant  string
	lastListTenant string
	lastListLimit  int
	lastListOffset int
	lastUpdateID   string
	lastUpdateAttr map[string]interface{}
	lastDeleteID   string
}

var _ service.RepositoryInterface = (*fakeStorageRepo)(nil)

func (f *fakeStorageRepo) Create(ctx context.Context, entity *models.StorageEntry) error {
	f.lastCreate = entity
	return f.createErr
}

func (f *fakeStorageRepo) GetByID(ctx context.Context, id, tenantID string) (*models.StorageEntry, error) {
	f.lastGetID = id
	f.lastGetTenant = tenantID
	return f.getByIDResult, f.getByIDErr
}

func (f *fakeStorageRepo) GetByBucketAndKey(ctx context.Context, bucket, key, tenantID string) (*models.StorageEntry, error) {
	return f.getByBKResult, f.getByBKErr
}

func (f *fakeStorageRepo) List(ctx context.Context, tenantID string, limit, offset int) ([]models.StorageEntry, error) {
	f.lastListTenant = tenantID
	f.lastListLimit = limit
	f.lastListOffset = offset
	return f.listResult, f.listErr
}

func (f *fakeStorageRepo) Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.StorageEntry, error) {
	f.lastUpdateID = id
	f.lastUpdateAttr = attrs
	return f.updateResult, f.updateErr
}

func (f *fakeStorageRepo) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	f.lastDeleteID = id
	return f.deleteResult, f.deleteErr
}

func (f *fakeStorageRepo) DeleteByBucketAndKey(ctx context.Context, bucket, key, tenantID string) (bool, error) {
	return f.deleteByBK, f.deleteByBKErr
}

// --- Tests ---

func TestService_NewService(t *testing.T) {
	s := service.NewService(&fakeStorageRepo{})
	if s == nil {
		t.Fatal("NewService returned nil")
	}
}

func TestService_NewService_WithFakeRepo(t *testing.T) {
	repo := &fakeStorageRepo{}
	s := service.NewService(repo)
	if s == nil {
		t.Fatal("NewService returned nil")
	}
}

func TestService_Create(t *testing.T) {
	repo := &fakeStorageRepo{}
	s := service.NewService(repo)

	entry, err := s.Create(context.Background(), "tenant-1", "my-bucket", "my-key", "s3")
	if err != nil {
		t.Fatalf("Create returned unexpected error: %v", err)
	}
	if entry == nil {
		t.Fatal("Create returned nil entry")
	}
	if entry.Bucket != "my-bucket" {
		t.Errorf("expected bucket 'my-bucket', got '%s'", entry.Bucket)
	}
	if entry.Key != "my-key" {
		t.Errorf("expected key 'my-key', got '%s'", entry.Key)
	}
	if entry.Provider != "s3" {
		t.Errorf("expected provider 's3', got '%s'", entry.Provider)
	}
	if entry.TenantID != "tenant-1" {
		t.Errorf("expected tenant 'tenant-1', got '%s'", entry.TenantID)
	}
	if entry.Size != 0 {
		t.Errorf("expected size 0, got %d", entry.Size)
	}
	if entry.ID == "" {
		t.Error("expected non-empty ID")
	}
	// Verify repo was called with correct args
	if repo.lastCreate == nil {
		t.Fatal("repo.Create was not called")
	}
	if repo.lastCreate.Bucket != "my-bucket" {
		t.Errorf("repo.Create got bucket '%s', want 'my-bucket'", repo.lastCreate.Bucket)
	}
	if repo.lastCreate.Key != "my-key" {
		t.Errorf("repo.Create got key '%s', want 'my-key'", repo.lastCreate.Key)
	}
}

func TestService_Create_ReturnsError(t *testing.T) {
	repo := &fakeStorageRepo{createErr: context.DeadlineExceeded}
	s := service.NewService(repo)

	entry, err := s.Create(context.Background(), "tenant-1", "bucket", "key", "s3")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if entry != nil {
		t.Error("expected nil entry on error")
	}
}

func TestService_GetByID(t *testing.T) {
	expected := &models.StorageEntry{ID: "123", TenantID: "tenant-1", Bucket: "b", Key: "k"}
	repo := &fakeStorageRepo{getByIDResult: expected}
	s := service.NewService(repo)

	entry, err := s.GetByID(context.Background(), "tenant-1", "123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if entry.ID != "123" {
		t.Errorf("expected ID '123', got '%s'", entry.ID)
	}
	if repo.lastGetID != "123" {
		t.Errorf("repo.GetByID got id '%s', want '123'", repo.lastGetID)
	}
	if repo.lastGetTenant != "tenant-1" {
		t.Errorf("repo.GetByID got tenant '%s', want 'tenant-1'", repo.lastGetTenant)
	}
}

func TestService_GetByID_ReturnsError(t *testing.T) {
	repo := &fakeStorageRepo{getByIDErr: context.Canceled}
	s := service.NewService(repo)

	entry, err := s.GetByID(context.Background(), "tenant-1", "123")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if entry != nil {
		t.Error("expected nil entry on error")
	}
}

func TestService_GetByBucketAndKey(t *testing.T) {
	expected := &models.StorageEntry{ID: "456", Bucket: "my-bucket", Key: "my-key"}
	repo := &fakeStorageRepo{getByBKResult: expected}
	s := service.NewService(repo)

	entry, err := s.GetByBucketAndKey(context.Background(), "tenant-1", "my-bucket", "my-key")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if entry.ID != "456" {
		t.Errorf("expected ID '456', got '%s'", entry.ID)
	}
}

func TestService_GetByBucketAndKey_ReturnsError(t *testing.T) {
	repo := &fakeStorageRepo{getByBKErr: context.DeadlineExceeded}
	s := service.NewService(repo)

	entry, err := s.GetByBucketAndKey(context.Background(), "tenant-1", "b", "k")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if entry != nil {
		t.Error("expected nil entry on error")
	}
}

func TestService_List(t *testing.T) {
	expected := []models.StorageEntry{
		{ID: "1", Bucket: "b1"},
		{ID: "2", Bucket: "b2"},
	}
	repo := &fakeStorageRepo{listResult: expected}
	s := service.NewService(repo)

	entries, err := s.List(context.Background(), "tenant-1", 10, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(entries) != 2 {
		t.Errorf("expected 2 entries, got %d", len(entries))
	}
	if repo.lastListTenant != "tenant-1" {
		t.Errorf("repo.List got tenant '%s', want 'tenant-1'", repo.lastListTenant)
	}
	if repo.lastListLimit != 10 {
		t.Errorf("repo.List got limit %d, want 10", repo.lastListLimit)
	}
	if repo.lastListOffset != 0 {
		t.Errorf("repo.List got offset %d, want 0", repo.lastListOffset)
	}
}

func TestService_List_DefaultLimit(t *testing.T) {
	repo := &fakeStorageRepo{listResult: nil}
	s := service.NewService(repo)

	_, err := s.List(context.Background(), "tenant-1", 0, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.lastListLimit != 50 {
		t.Errorf("expected default limit 50, got %d", repo.lastListLimit)
	}
}

func TestService_List_NegativeLimit(t *testing.T) {
	repo := &fakeStorageRepo{listResult: nil}
	s := service.NewService(repo)

	_, err := s.List(context.Background(), "tenant-1", -5, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.lastListLimit != 50 {
		t.Errorf("expected default limit 50, got %d", repo.lastListLimit)
	}
}

func TestService_List_NegativeOffset(t *testing.T) {
	repo := &fakeStorageRepo{listResult: nil}
	s := service.NewService(repo)

	_, err := s.List(context.Background(), "tenant-1", 10, -3)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.lastListOffset != 0 {
		t.Errorf("expected default offset 0, got %d", repo.lastListOffset)
	}
}

func TestService_List_ReturnsError(t *testing.T) {
	repo := &fakeStorageRepo{listErr: context.Canceled}
	s := service.NewService(repo)

	entries, err := s.List(context.Background(), "tenant-1", 10, 0)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if entries != nil {
		t.Error("expected nil entries on error")
	}
}

func TestService_Update(t *testing.T) {
	expected := &models.StorageEntry{ID: "123", Key: "new-key"}
	repo := &fakeStorageRepo{updateResult: expected}
	s := service.NewService(repo)

	newKey := "new-key"
	entry, err := s.Update(context.Background(), "tenant-1", "123", &newKey)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if entry.ID != "123" {
		t.Errorf("expected ID '123', got '%s'", entry.ID)
	}
	if repo.lastUpdateID != "123" {
		t.Errorf("repo.Update got id '%s', want '123'", repo.lastUpdateID)
	}
	if repo.lastUpdateAttr["key"] != "new-key" {
		t.Errorf("repo.Update attrs key '%v', want 'new-key'", repo.lastUpdateAttr["key"])
	}
	if _, ok := repo.lastUpdateAttr["updated_at"]; !ok {
		t.Error("repo.Update attrs missing 'updated_at'")
	}
}

func TestService_Update_NilKey(t *testing.T) {
	repo := &fakeStorageRepo{updateResult: &models.StorageEntry{ID: "123"}}
	s := service.NewService(repo)

	entry, err := s.Update(context.Background(), "tenant-1", "123", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if entry.ID != "123" {
		t.Errorf("expected ID '123', got '%s'", entry.ID)
	}
	if _, ok := repo.lastUpdateAttr["key"]; ok {
		t.Error("repo.Update attrs should not contain 'key' when input is nil")
	}
	if _, ok := repo.lastUpdateAttr["updated_at"]; !ok {
		t.Error("repo.Update attrs missing 'updated_at'")
	}
}

func TestService_Update_ReturnsError(t *testing.T) {
	repo := &fakeStorageRepo{updateErr: context.DeadlineExceeded}
	s := service.NewService(repo)

	newKey := "x"
	entry, err := s.Update(context.Background(), "tenant-1", "123", &newKey)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if entry != nil {
		t.Error("expected nil entry on error")
	}
}

func TestService_Delete(t *testing.T) {
	repo := &fakeStorageRepo{deleteResult: true}
	s := service.NewService(repo)

	deleted, err := s.Delete(context.Background(), "tenant-1", "123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !deleted {
		t.Error("expected deleted=true")
	}
	if repo.lastDeleteID != "123" {
		t.Errorf("repo.Delete got id '%s', want '123'", repo.lastDeleteID)
	}
}

func TestService_Delete_ReturnsError(t *testing.T) {
	repo := &fakeStorageRepo{deleteErr: context.Canceled}
	s := service.NewService(repo)

	deleted, err := s.Delete(context.Background(), "tenant-1", "123")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if deleted {
		t.Error("expected deleted=false on error")
	}
}

func TestService_DeleteByBucketAndKey(t *testing.T) {
	repo := &fakeStorageRepo{deleteByBK: true}
	s := service.NewService(repo)

	deleted, err := s.DeleteByBucketAndKey(context.Background(), "tenant-1", "my-bucket", "my-key")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !deleted {
		t.Error("expected deleted=true")
	}
}

func TestService_DeleteByBucketAndKey_ReturnsError(t *testing.T) {
	repo := &fakeStorageRepo{deleteByBKErr: context.DeadlineExceeded}
	s := service.NewService(repo)

	deleted, err := s.DeleteByBucketAndKey(context.Background(), "tenant-1", "b", "k")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if deleted {
		t.Error("expected deleted=false on error")
	}
}
