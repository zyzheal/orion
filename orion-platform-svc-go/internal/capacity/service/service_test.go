package service

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/capacity/models"
)

// fakeRepo is an in-memory RepositoryInterface for unit tests.
// It mimics the soft-delete semantics of the real repository.
type fakeRepo struct {
	mu      sync.Mutex
	records map[string]*models.Record
	order   []string
	base    time.Time
	tick    time.Duration
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		records: make(map[string]*models.Record),
		base:    time.Unix(0, 0).UTC(),
		tick:    time.Second,
	}
}

// now returns a monotonic time that advances on every call so that
// UpdatedAt > CreatedAt is guaranteed in tests.
func (r *fakeRepo) now() time.Time {
	t := r.base.Add(r.tick)
	r.base = t
	return t
}

func (r *fakeRepo) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]models.Record, 0)
	for _, id := range r.order {
		rec := r.records[id]
		if rec == nil || rec.TenantID != tenantID || rec.DeletedAt != nil {
			continue
		}
		out = append(out, *rec)
	}
	return out, nil
}

func (r *fakeRepo) GetByID(ctx context.Context, tenantID, id string) (*models.Record, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rec := r.records[id]
	if rec == nil || rec.TenantID != tenantID || rec.DeletedAt != nil {
		return nil, sentinel.NotFound
	}
	cp := *rec
	return &cp, nil
}

func (r *fakeRepo) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	id := "id-" + tenantID + "-" + req.Name
	status := req.Status
	if status == "" {
		status = models.StatusActive
	}
	now := r.now()
	rec := &models.Record{
		ID:        id,
		TenantID:  tenantID,
		Name:      req.Name,
		Status:    status,
		Metadata:  req.Config,
		CreatedAt: now,
		UpdatedAt: now,
	}
	r.records[id] = rec
	r.order = append(r.order, id)
	return rec, nil
}

func (r *fakeRepo) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rec := r.records[id]
	if rec == nil || rec.TenantID != tenantID || rec.DeletedAt != nil {
		return nil, sentinel.NotFound
	}
	rec.Name = req.Name
	if req.Status == "" {
		rec.Status = models.StatusActive
	} else {
		rec.Status = req.Status
	}
	rec.Metadata = req.Config
	rec.UpdatedAt = r.now()
	return rec, nil
}

func (r *fakeRepo) Delete(ctx context.Context, tenantID, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	rec := r.records[id]
	if rec == nil || rec.TenantID != tenantID || rec.DeletedAt != nil {
		return sentinel.NotFound
	}
	now := r.now()
	rec.DeletedAt = &now
	return nil
}

// Ensure *fakeRepo implements RepositoryInterface at compile time.
var _ RepositoryInterface = (*fakeRepo)(nil)

func TestCreate_ThenListReturnsRecord(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	created, err := svc.Create(context.Background(), "t1", models.CreateRequest{Name: "cluster-a"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if created.Status != "active" {
		t.Errorf("default status = %q, want %q", created.Status, "active")
	}

	list, err := svc.List(context.Background(), "t1")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 record, got %d", len(list))
	}
}

func TestCreate_TenantIsolation(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	_, _ = svc.Create(context.Background(), "t1", models.CreateRequest{Name: "a"})
	_, _ = svc.Create(context.Background(), "t2", models.CreateRequest{Name: "a"})
	_, _ = svc.Create(context.Background(), "t2", models.CreateRequest{Name: "b"})

	n1, _ := svc.List(context.Background(), "t1")
	if len(n1) != 1 {
		t.Errorf("t1 records = %d, want 1", len(n1))
	}
	n2, _ := svc.List(context.Background(), "t2")
	if len(n2) != 2 {
		t.Errorf("t2 records = %d, want 2", len(n2))
	}
}

func TestGet_NotFoundWhenAbsent(t *testing.T) {
	svc := NewService(newFakeRepo())
	_, err := svc.Get(context.Background(), "t1", "nope")
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("expected NotFound, got %v", err)
	}
}

func TestUpdate_NotFoundOnDeleted(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	c, _ := svc.Create(context.Background(), "t1", models.CreateRequest{Name: "a"})
	if err := svc.Delete(context.Background(), "t1", c.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := svc.Update(context.Background(), "t1", c.ID, models.CreateRequest{Name: "b"}); !errors.Is(err, sentinel.NotFound) {
		t.Errorf("Update after delete: expected NotFound, got %v", err)
	}
}

func TestDelete_IsSoftAndIdempotent(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	c, _ := svc.Create(context.Background(), "t1", models.CreateRequest{Name: "a"})

	if err := svc.Delete(context.Background(), "t1", c.ID); err != nil {
		t.Fatalf("first Delete: %v", err)
	}
	if err := svc.Delete(context.Background(), "t1", c.ID); !errors.Is(err, sentinel.NotFound) {
		t.Errorf("second Delete: expected NotFound, got %v", err)
	}
	list, _ := svc.List(context.Background(), "t1")
	if len(list) != 0 {
		t.Errorf("List after delete: expected 0, got %d", len(list))
	}
}

func TestUpdate_ChangesNameAndStatus(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	c, _ := svc.Create(context.Background(), "t1", models.CreateRequest{Name: "v1", Config: map[string]interface{}{"x": 1}})

	u, err := svc.Update(context.Background(), "t1", c.ID, models.CreateRequest{Name: "v2", Status: "deprecated", Config: map[string]interface{}{"x": 2}})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if u.Name != "v2" || u.Status != "deprecated" {
		t.Errorf("update result = %v", u)
	}
	if u.Metadata["x"] != 2 {
		t.Errorf("metadata.x = %v, want 2", u.Metadata["x"])
	}
	if !u.UpdatedAt.After(u.CreatedAt) {
		t.Error("UpdatedAt should be after CreatedAt")
	}
}
