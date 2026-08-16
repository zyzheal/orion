package service

import (
	"context"
	"testing"

	"orion/platform-svc-go/internal/vector-store/models"
)

func TestService_NilRepo(t *testing.T) {
	s := NewService(nil)
	if s == nil {
		t.Fatal("expected non-nil service")
	}
}

// --- Mock repository for integration-style tests ---

type mockRepo struct {
	created []*models.VectorStore
	updated []*models.VectorStore
	deleted []string
	err     error
}

func (m *mockRepo) Create(ctx context.Context, v *models.VectorStore) error {
	if m.err != nil {
		return m.err
	}
	m.created = append(m.created, v)
	return nil
}

func (m *mockRepo) Delete(ctx context.Context, tenantID, id string) error {
	if m.err != nil {
		return m.err
	}
	m.deleted = append(m.deleted, id)
	return nil
}

func (m *mockRepo) GetByID(ctx context.Context, tenantID, id string) (*models.VectorStore, error) {
	if m.err != nil {
		return nil, m.err
	}
	return &models.VectorStore{ID: id, TenantID: tenantID, Name: "test"}, nil
}

func (m *mockRepo) List(ctx context.Context, tenantID string) ([]models.VectorStore, error) {
	if m.err != nil {
		return nil, m.err
	}
	return []models.VectorStore{{ID: "1", TenantID: tenantID}}, nil
}

func (m *mockRepo) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.VectorStore, error) {
	if m.err != nil {
		return nil, m.err
	}
	v := &models.VectorStore{ID: id, TenantID: tenantID}
	m.updated = append(m.updated, v)
	return v, nil
}

func TestService_Create(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	ctx := context.Background()

	req := models.CreateVectorStoreRequest{Name: "vs1", Value: "val1", Enabled: true}
	vs, err := svc.Create(ctx, "t1", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if vs.Name != "vs1" {
		t.Errorf("expected name vs1, got %s", vs.Name)
	}
	if vs.TenantID != "t1" {
		t.Errorf("expected tenantID t1, got %s", vs.TenantID)
	}
	if vs.Enabled != true {
		t.Errorf("expected enabled=true")
	}
	if len(repo.created) != 1 {
		t.Errorf("expected 1 create call, got %d", len(repo.created))
	}
}

func TestService_CreateReturnsRepoError(t *testing.T) {
	repo := &mockRepo{err: context.DeadlineExceeded}
	svc := NewService(repo)
	_, err := svc.Create(context.Background(), "t1", models.CreateVectorStoreRequest{Name: "x"})
	if err == nil {
		t.Error("expected error from repo")
	}
}

func TestService_Get(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	vs, err := svc.Get(context.Background(), "t1", "id1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if vs.ID != "id1" {
		t.Errorf("expected id1, got %s", vs.ID)
	}
}

func TestService_GetReturnsRepoError(t *testing.T) {
	repo := &mockRepo{err: context.Canceled}
	svc := NewService(repo)
	_, err := svc.Get(context.Background(), "t1", "id1")
	if err == nil {
		t.Error("expected error")
	}
}

func TestService_List(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	list, err := svc.List(context.Background(), "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(list) != 1 {
		t.Errorf("expected 1 item, got %d", len(list))
	}
}

func TestService_Update(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	name := "newName"
	enabled := true
	vs, err := svc.Update(context.Background(), "t1", "id1", models.UpdateVectorStoreRequest{
		Name: &name, Enabled: &enabled,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if vs.ID != "id1" {
		t.Errorf("expected id1, got %s", vs.ID)
	}
	if len(repo.updated) != 1 {
		t.Errorf("expected 1 update call, got %d", len(repo.updated))
	}
}

func TestService_UpdateEmptyFields(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	_, err := svc.Update(context.Background(), "t1", "id1", models.UpdateVectorStoreRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(repo.updated) != 1 {
		t.Errorf("expected update call even with empty fields")
	}
}

func TestService_Delete(t *testing.T) {
	repo := &mockRepo{}
	svc := NewService(repo)
	err := svc.Delete(context.Background(), "t1", "id1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(repo.deleted) != 1 || repo.deleted[0] != "id1" {
		t.Errorf("expected deleted[0]=id1, got %v", repo.deleted)
	}
}

func TestService_DeleteReturnsRepoError(t *testing.T) {
	repo := &mockRepo{err: context.DeadlineExceeded}
	svc := NewService(repo)
	err := svc.Delete(context.Background(), "t1", "id1")
	if err == nil {
		t.Error("expected error")
	}
}

func TestVectorStoreModelFields(t *testing.T) {
	vs := models.VectorStore{
		ID:       "v1",
		TenantID: "t1",
		Name:     "test",
		Value:    "val",
		Enabled:  true,
	}
	if vs.ID != "v1" || vs.Name != "test" || vs.Enabled != true {
		t.Error("VectorStore field access failed")
	}
}
