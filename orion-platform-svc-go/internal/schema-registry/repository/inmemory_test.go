package repository

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"orion/platform-svc-go/internal/schema-registry/models"
)

func newSchema(ns, name string, version int) *models.Schema {
	return &models.Schema{
		ID:          ns + "/" + name,
		Name:        name,
		Namespace:   ns,
		Type:        models.SchemaTypeProtobuf,
		Version:     version,
		Status:      models.SchemaActive,
		Owner:       "owner",
		Fields:      []models.SchemaField{{Name: "id", Type: "int64", PrimaryKey: true}},
		Compatibility: models.CompatibilityBackward,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
}

func TestInMemory_CreateAndGet(t *testing.T) {
	r := NewInMemory()
	ctx := context.Background()
	s := newSchema("ns1", "users", 1)
	if err := r.CreateSchema(ctx, s); err != nil {
		t.Fatalf("create: %v", err)
	}
	got, err := r.GetSchema(ctx, "ns1", "users")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got == nil || got.Name != "users" || got.Namespace != "ns1" {
		t.Fatalf("unexpected: %v", got)
	}
}

func TestInMemory_CreateDuplicateRejected(t *testing.T) {
	r := NewInMemory()
	ctx := context.Background()
	if err := r.CreateSchema(ctx, newSchema("ns", "x", 1)); err != nil {
		t.Fatal(err)
	}
	if err := r.CreateSchema(ctx, newSchema("ns", "x", 1)); err == nil {
		t.Fatal("expected duplicate error")
	}
}

func TestInMemory_GetMissingReturnsNil(t *testing.T) {
	r := NewInMemory()
	got, err := r.GetSchema(context.Background(), "ns", "missing")
	if err != nil {
		t.Fatalf("expected no error for missing, got %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil, got %v", got)
	}
}

func TestInMemory_UpdatePersists(t *testing.T) {
	r := NewInMemory()
	ctx := context.Background()
	s := newSchema("ns", "y", 1)
	if err := r.CreateSchema(ctx, s); err != nil {
		t.Fatal(err)
	}
	s.Version = 2
	s.UpdatedAt = time.Now()
	if err := r.UpdateSchema(ctx, s); err != nil {
		t.Fatalf("update: %v", err)
	}
	got, _ := r.GetSchema(ctx, "ns", "y")
	if got.Version != 2 {
		t.Fatalf("expected version 2, got %d", got.Version)
	}
}

func TestInMemory_UpdateMissingFails(t *testing.T) {
	r := NewInMemory()
	err := r.UpdateSchema(context.Background(), newSchema("ns", "missing", 1))
	if err == nil {
		t.Fatal("expected error for missing schema")
	}
}

func TestInMemory_Delete(t *testing.T) {
	r := NewInMemory()
	ctx := context.Background()
	if err := r.CreateSchema(ctx, newSchema("ns", "z", 1)); err != nil {
		t.Fatal(err)
	}
	if err := r.DeleteSchema(ctx, "ns", "z"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	got, _ := r.GetSchema(ctx, "ns", "z")
	if got != nil {
		t.Fatalf("expected nil after delete, got %v", got)
	}
	// Second delete should report ErrSchemaNotFound.
	if err := r.DeleteSchema(ctx, "ns", "z"); !errors.Is(err, ErrSchemaNotFound) {
		t.Fatalf("expected ErrSchemaNotFound, got %v", err)
	}
}

func TestInMemory_ListFiltersByNamespace(t *testing.T) {
	r := NewInMemory()
	ctx := context.Background()
	for _, ns := range []string{"ns1", "ns2"} {
		if err := r.CreateSchema(ctx, newSchema(ns, "x", 1)); err != nil {
			t.Fatal(err)
		}
	}
	all, err := r.ListSchemas(ctx, "")
	if err != nil || len(all) != 2 {
		t.Fatalf("expected 2, got %d err=%v", len(all), err)
	}
	only, err := r.ListSchemas(ctx, "ns1")
	if err != nil || len(only) != 1 {
		t.Fatalf("expected 1, got %d err=%v", len(only), err)
	}
}

func TestInMemory_QueryFiltersByTypeStatusOwner(t *testing.T) {
	r := NewInMemory()
	ctx := context.Background()
	if err := r.CreateSchema(ctx, newSchema("ns", "a", 1)); err != nil {
		t.Fatal(err)
	}
	b := newSchema("ns", "b", 1)
	b.Type = models.SchemaTypeJSON
	b.Status = models.SchemaDeprecated
	if err := r.CreateSchema(ctx, b); err != nil {
		t.Fatal(err)
	}
	got, total, err := r.QuerySchemas(ctx, &models.QueryRequest{Namespace: "ns", Status: models.SchemaActive})
	if err != nil || total != 1 || len(got) != 1 {
		t.Fatalf("expected 1 active, got %d/%d err=%v", len(got), total, err)
	}
}

func TestInMemory_Versions(t *testing.T) {
	r := NewInMemory()
	ctx := context.Background()
	s := newSchema("ns", "c", 1)
	if err := r.CreateSchema(ctx, s); err != nil {
		t.Fatal(err)
	}
	if err := r.AppendVersion(ctx, "ns", "c", &models.SchemaVersion{Version: 1, ReleasedAt: time.Now(), ReleasedBy: "o1"}); err != nil {
		t.Fatal(err)
	}
	if err := r.AppendVersion(ctx, "ns", "c", &models.SchemaVersion{Version: 2, ReleasedAt: time.Now(), ReleasedBy: "o2"}); err != nil {
		t.Fatal(err)
	}
	// GetLatestVersion reads the Schema's own Version field, which is set
	// independently of version history entries. Update it explicitly.
	s.Version = 2
	if err := r.UpdateSchema(ctx, s); err != nil {
		t.Fatal(err)
	}
	ver, err := r.GetLatestVersion(ctx, "ns", "c")
	if err != nil || ver != 2 {
		t.Fatalf("expected latest version 2, got %d err=%v", ver, err)
	}
	hist, err := r.GetVersionHistory(ctx, "ns", "c", 0)
	if err != nil || len(hist) != 2 {
		t.Fatalf("history failed: %v (err %v)", hist, err)
	}
	got, err := r.GetVersion(ctx, "ns", "c", 2)
	if err != nil {
		t.Fatalf("get version: %v", err)
	}
	if got.Version != 2 {
		t.Fatalf("expected v2, got %d", got.Version)
	}
}

func TestInMemory_VersionsLimitTruncates(t *testing.T) {
	r := NewInMemory()
	ctx := context.Background()
	if err := r.CreateSchema(ctx, newSchema("ns", "d", 1)); err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= 5; i++ {
		if err := r.AppendVersion(ctx, "ns", "d", &models.SchemaVersion{Version: i}); err != nil {
			t.Fatal(err)
		}
	}
	hist, err := r.GetVersionHistory(ctx, "ns", "d", 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(hist) != 2 {
		t.Fatalf("expected 2 latest versions, got %d", len(hist))
	}
	// Should be the most recent two.
	if hist[0].Version != 4 || hist[1].Version != 5 {
		t.Fatalf("expected v4, v5 but got %d, %d", hist[0].Version, hist[1].Version)
	}
}

func TestInMemory_GetCompatibility(t *testing.T) {
	r := NewInMemory()
	ctx := context.Background()
	s := newSchema("ns", "e", 1)
	s.Compatibility = models.CompatibilityFull
	if err := r.CreateSchema(ctx, s); err != nil {
		t.Fatal(err)
	}
	mode, err := r.GetCompatibility(ctx, "ns", "e")
	if err != nil {
		t.Fatalf("compat: %v", err)
	}
	if mode != models.CompatibilityFull {
		t.Fatalf("expected full, got %s", mode)
	}
}

func TestInMemory_ConcurrentAccess(t *testing.T) {
	r := NewInMemory()
	ctx := context.Background()
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			ns := "ns" + string(rune('a'+i))
			_ = r.CreateSchema(ctx, newSchema(ns, "s", 1))
			_, _ = r.GetSchema(ctx, ns, "s")
			_, _, _ = r.QuerySchemas(ctx, &models.QueryRequest{})
		}(i)
	}
	wg.Wait()
	if got, _ := r.ListSchemas(ctx, ""); len(got) != 20 {
		t.Fatalf("expected 20 schemas, got %d", len(got))
	}
}
