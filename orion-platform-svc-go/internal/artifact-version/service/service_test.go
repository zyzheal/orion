package service

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/artifact-version/models"
)

// fakeRepo is an in-memory RepositoryInterface for unit tests.
// It mimics the soft-delete and tag-dedup semantics of the real repository.
type fakeRepo struct {
	mu      sync.Mutex
	records map[string]*models.Record
	tags    map[string][]models.Tag // key = tenantID + "|" + recordID
	order   []string                // insertion order for List()
	base    time.Time               // base time for deterministic tests
	tick    time.Duration
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		records: make(map[string]*models.Record),
		tags:    make(map[string][]models.Tag),
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
	rec.Status = req.Status
	if rec.Status == "" {
		rec.Status = models.StatusActive
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

func (r *fakeRepo) ListTags(ctx context.Context, tenantID, recordID string) ([]models.Tag, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := tenantID + "|" + recordID
	tags := r.tags[key]
	out := make([]models.Tag, len(tags))
	copy(out, tags)
	return out, nil
}

func (r *fakeRepo) AddTag(ctx context.Context, tenantID, recordID, tag string) (*models.Tag, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := tenantID + "|" + recordID
	for _, t := range r.tags[key] {
		if t.Tag == tag {
			return &t, nil
		}
	}
	t := models.Tag{
		ID:        "tag-" + tag,
		TenantID:  tenantID,
		RecordID:  recordID,
		Tag:       tag,
		CreatedAt: r.now(),
	}
	r.tags[key] = append(r.tags[key], t)
	return &t, nil
}

func (r *fakeRepo) DeleteTag(ctx context.Context, tenantID, recordID, tag string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := tenantID + "|" + recordID
	list := r.tags[key]
	for i, t := range list {
		if t.Tag == tag {
			r.tags[key] = append(list[:i], list[i+1:]...)
			return nil
		}
	}
	return sentinel.NotFound
}

// Ensure *fakeRepo implements RepositoryInterface at compile time.
var _ RepositoryInterface = (*fakeRepo)(nil)

// =====================================================================
// CRUD tests
// =====================================================================

func TestCreate_ThenListReturnsRecord(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)

	created, err := svc.Create(context.Background(), "t1", models.CreateRequest{Name: "artifact-v1"})
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

	// Same name in a different tenant should also work.
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
	// Second delete is NotFound.
	if err := svc.Delete(context.Background(), "t1", c.ID); !errors.Is(err, sentinel.NotFound) {
		t.Errorf("second Delete: expected NotFound, got %v", err)
	}
	// List should not include deleted records.
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

// =====================================================================
// Tag tests
// =====================================================================

func TestAddTag_ListAndDelete(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	c, _ := svc.Create(context.Background(), "t1", models.CreateRequest{Name: "a"})

	tag, err := svc.AddTag(context.Background(), "t1", c.ID, "prod")
	if err != nil {
		t.Fatalf("AddTag: %v", err)
	}
	if tag.Tag != "prod" {
		t.Errorf("tag.Tag = %q, want prod", tag.Tag)
	}

	// Adding same tag again is idempotent.
	_, _ = svc.AddTag(context.Background(), "t1", c.ID, "prod")

	tags, err := svc.ListTags(context.Background(), "t1", c.ID)
	if err != nil {
		t.Fatalf("ListTags: %v", err)
	}
	if len(tags) != 1 {
		t.Fatalf("expected 1 tag, got %d", len(tags))
	}
	if tags[0].Name != "prod" {
		t.Errorf("ListTags[0].Name = %q, want prod", tags[0].Name)
	}
	if tags[0].Status != "tag" {
		t.Errorf("ListTags[0].Status = %q, want tag", tags[0].Status)
	}

	if err := svc.DeleteTag(context.Background(), "t1", c.ID, "prod"); err != nil {
		t.Fatalf("DeleteTag: %v", err)
	}
	if err := svc.DeleteTag(context.Background(), "t1", c.ID, "prod"); !errors.Is(err, sentinel.NotFound) {
		t.Errorf("second DeleteTag: expected NotFound, got %v", err)
	}
}

func TestAddTag_EmptyTagIsNoOp(t *testing.T) {
	svc := NewService(newFakeRepo())
	c, _ := svc.Create(context.Background(), "t1", models.CreateRequest{Name: "a"})

	got, err := svc.AddTag(context.Background(), "t1", c.ID, "")
	if err != nil {
		t.Fatalf("AddTag empty: %v", err)
	}
	if got != nil {
		t.Errorf("expected nil result for empty tag, got %v", got)
	}
}

func TestDeleteTag_TenantIsolation(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	c1, _ := svc.Create(context.Background(), "t1", models.CreateRequest{Name: "a"})
	c2, _ := svc.Create(context.Background(), "t2", models.CreateRequest{Name: "a"})

	_, _ = svc.AddTag(context.Background(), "t1", c1.ID, "prod")
	// t2 cannot see t1's tag (different tenant + different record).
	if err := svc.DeleteTag(context.Background(), "t2", c2.ID, "prod"); !errors.Is(err, sentinel.NotFound) {
		t.Errorf("cross-tenant DeleteTag: expected NotFound, got %v", err)
	}
	if _, err := svc.ListTags(context.Background(), "t2", c2.ID); err != nil {
		t.Fatalf("ListTags t2: %v", err)
	}
}

// =====================================================================
// Derived query tests
// =====================================================================

func TestGetStats_AggregatesByStatus(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	_, _ = svc.Create(context.Background(), "t1", models.CreateRequest{Name: "a", Status: "active"})
	_, _ = svc.Create(context.Background(), "t1", models.CreateRequest{Name: "b", Status: "active"})
	_, _ = svc.Create(context.Background(), "t1", models.CreateRequest{Name: "c", Status: "deprecated"})

	stats, err := svc.GetStats(context.Background(), "t1")
	if err != nil {
		t.Fatalf("GetStats: %v", err)
	}
	if stats["total"] != 3 {
		t.Errorf("total = %v, want 3", stats["total"])
	}
	byStatus, _ := stats["byStatus"].(map[string]int)
	if byStatus["active"] != 2 || byStatus["deprecated"] != 1 {
		t.Errorf("byStatus = %v", byStatus)
	}
}

func TestGetStats_EmptyTenantReturnsZero(t *testing.T) {
	svc := NewService(newFakeRepo())
	stats, _ := svc.GetStats(context.Background(), "t1")
	if stats["total"] != 0 {
		t.Errorf("total = %v, want 0", stats["total"])
	}
}

func TestGetHistory_ReturnsCurrentStatus(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	_, _ = svc.Create(context.Background(), "t1", models.CreateRequest{Name: "a", Status: "running"})

	got, err := svc.GetHistory(context.Background(), "t1", "id-t1-a")
	if err != nil {
		t.Fatalf("GetHistory: %v", err)
	}
	if len(got) != 1 || got[0] != "running" {
		t.Errorf("history = %v, want [running]", got)
	}
}

func TestGetHistory_NotFoundReturnsEmpty(t *testing.T) {
	svc := NewService(newFakeRepo())
	got, err := svc.GetHistory(context.Background(), "t1", "nope")
	if err != nil {
		t.Fatalf("GetHistory: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected empty history, got %v", got)
	}
}

func TestSearch_FiltersByNameAndStatus(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	_, _ = svc.Create(context.Background(), "t1", models.CreateRequest{Name: "alpha", Status: "active"})
	_, _ = svc.Create(context.Background(), "t1", models.CreateRequest{Name: "beta", Status: "deprecated"})
	_, _ = svc.Create(context.Background(), "t1", models.CreateRequest{Name: "gamma", Status: "active"})

	byName, _ := svc.Search(context.Background(), "t1", "alpha")
	if len(byName) != 1 || byName[0] != "id-t1-alpha" {
		t.Errorf("search by name: %v", byName)
	}
	byStatus, _ := svc.Search(context.Background(), "t1", "deprecated")
	if len(byStatus) != 1 || byStatus[0] != "id-t1-beta" {
		t.Errorf("search by status: %v", byStatus)
	}
	if empty, _ := svc.Search(context.Background(), "t1", ""); len(empty) != 0 {
		t.Errorf("empty query: %v", empty)
	}
}

func TestCheckCompatibility_FailsWhenRecordMissing(t *testing.T) {
	svc := NewService(newFakeRepo())
	if _, err := svc.CheckCompatibility(context.Background(), "t1", "nope"); !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("expected NotFound, got %v", err)
	}
}

func TestCheckCompatibility_SucceedsOnExistingRecord(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	_, _ = svc.Create(context.Background(), "t1", models.CreateRequest{Name: "a", Status: "stable"})

	out, err := svc.CheckCompatibility(context.Background(), "t1", "id-t1-a")
	if err != nil {
		t.Fatalf("CheckCompatibility: %v", err)
	}
	if out["compatible"] != true {
		t.Errorf("compatible = %v, want true", out["compatible"])
	}
	if out["id"] != "id-t1-a" {
		t.Errorf("id = %v", out["id"])
	}
}

func TestGetStatus_ReturnsRecordStatus(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	_, _ = svc.Create(context.Background(), "t1", models.CreateRequest{Name: "a", Status: "building"})

	st, err := svc.GetStatus(context.Background(), "t1", "id-t1-a")
	if err != nil {
		t.Fatalf("GetStatus: %v", err)
	}
	if st != "building" {
		t.Errorf("status = %q, want building", st)
	}
}

func TestGetConfig_ReturnsMetadata(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo)
	_, _ = svc.Create(context.Background(), "t1", models.CreateRequest{Name: "a", Config: map[string]interface{}{"owner": "team-x"}})

	cfg, err := svc.GetConfig(context.Background(), "t1", "id-t1-a")
	if err != nil {
		t.Fatalf("GetConfig: %v", err)
	}
	if cfg["metadata"].(map[string]interface{})["owner"] != "team-x" {
		t.Errorf("metadata = %v", cfg["metadata"])
	}
}

func TestValidateBranch_RejectsEmpty(t *testing.T) {
	svc := NewService(newFakeRepo())
	okEmpty, _ := svc.ValidateBranch(context.Background(), "t1", "")
	if okEmpty {
		t.Error("empty branch should be invalid")
	}
	okMain, _ := svc.ValidateBranch(context.Background(), "t1", "main")
	if !okMain {
		t.Error("main should be valid")
	}
}
