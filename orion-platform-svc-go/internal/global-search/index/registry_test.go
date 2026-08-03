package index

import (
	"context"
	"sync"
	"testing"

	"orion/platform-svc-go/internal/global-search/interfaces"
)

// mockSearchIndexer implements interfaces.SearchIndexer for testing.
type mockSearchIndexer struct {
	module    string
	indexName string
	count     int64
	countErr  error
	reindexFn func() error
	deleteErr error
}

func (m *mockSearchIndexer) Module() string {
	return m.module
}

func (m *mockSearchIndexer) IndexName() string {
	return m.indexName
}

func (m *mockSearchIndexer) Reindex(ctx context.Context) error {
	if m.reindexFn != nil {
		return m.reindexFn()
	}
	return nil
}

func (m *mockSearchIndexer) DeleteIndex(ctx context.Context) error {
	return m.deleteErr
}

func (m *mockSearchIndexer) Documents(ctx context.Context, offset, limit int) (docs []*interfaces.Document, next int, err error) {
	return docs, next, err
}

func (m *mockSearchIndexer) Count(ctx context.Context) (int64, error) {
	return m.count, m.countErr
}

func (m *mockSearchIndexer) Config() interfaces.IndexerConfig {
	return interfaces.IndexerConfig{
		BatchSize:       100,
		RefreshInterval: "5s",
		Replicas:        0,
		Shards:          1,
	}
}

func TestRegistryNew(t *testing.T) {
	reg := New(nil)
	if reg == nil {
		t.Fatal("New(nil) returned nil")
	}
	if len(reg.All()) != 0 {
		t.Errorf("empty registry All() = %d, want 0", len(reg.All()))
	}
	if client := reg.ESClient(); client != nil {
		t.Errorf("ESClient() = non-nil, want nil")
	}
}

func TestRegistryRegisterAndGet(t *testing.T) {
	reg := New(nil)
	idx := &mockSearchIndexer{module: "ticket", indexName: "ticket_v1"}
	reg.Register(idx)

	got := reg.Get("ticket")
	if got != idx {
		t.Fatal("Get returned wrong indexer")
	}

	nilGot := reg.Get("nonexistent")
	if nilGot != nil {
		t.Fatal("Get on unknown module should return nil")
	}
}

func TestRegistryAll(t *testing.T) {
	reg := New(nil)
	reg.Register(&mockSearchIndexer{module: "ticket", indexName: "ticket_v1"})
	reg.Register(&mockSearchIndexer{module: "alert", indexName: "alert_v1"})
	reg.Register(&mockSearchIndexer{module: "cmdb", indexName: "cmdb_v1"})

	names := reg.All()
	if len(names) != 3 {
		t.Fatalf("All() length = %d, want 3", len(names))
	}

	// Verify the returned slice is a copy (mutating it doesn't affect the registry).
	names = append(names, "fake")
	if len(reg.All()) != 3 {
		t.Errorf("All() was mutated via returned slice, length = %d", len(reg.All()))
	}
}

func TestRegistryUnregister(t *testing.T) {
	reg := New(nil)
	idx := &mockSearchIndexer{module: "ticket", indexName: "ticket_v1"}
	reg.Register(idx)
	if reg.Get("ticket") == nil {
		t.Fatal("indexer should exist before unregister")
	}

	reg.Unregister("ticket")
	if reg.Get("ticket") != nil {
		t.Fatal("indexer should be gone after unregister")
	}

	// Unregister non-existent module should not panic.
	reg.Unregister("nonexistent")
}

func TestRegistryRegisterOverwrite(t *testing.T) {
	reg := New(nil)
	idx1 := &mockSearchIndexer{module: "ticket", indexName: "ticket_v1"}
	idx2 := &mockSearchIndexer{module: "ticket", indexName: "ticket_v2"}

	reg.Register(idx1)
	reg.Register(idx2)

	got := reg.Get("ticket")
	if got != idx2 {
		t.Fatal("register should overwrite existing module")
	}

	// All() should still only show one module named "ticket".
	names := reg.All()
	count := 0
	for _, n := range names {
		if n == "ticket" {
			count++
		}
	}
	if count != 1 {
		t.Errorf("All() has %d 'ticket' entries, want 1", count)
	}
}

func TestRegistryConcurrentAccess(t *testing.T) {
	reg := New(nil)
	const n = 100
	var wg sync.WaitGroup

	// 4 groups of n goroutines = 4*n total.
	wg.Add(n * 4)

	// Concurrent registers.
	for i := 0; i < n; i++ {
		go func(i int) {
			defer wg.Done()
			mod := "mod-" + string(rune('A'+i%26))
			reg.Register(&mockSearchIndexer{module: mod, indexName: mod + "_v1"})
		}(i)
	}

	// Concurrent reads.
	for i := 0; i < n; i++ {
		go func(i int) {
			defer wg.Done()
			mod := "mod-" + string(rune('A'+i%26))
			reg.Get(mod)
		}(i)
	}

	// Concurrent All().
	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			reg.All()
		}()
	}

	// Concurrent unregisters.
	for i := 0; i < n; i++ {
		go func(i int) {
			defer wg.Done()
			mod := "mod-" + string(rune('A'+i%26))
			reg.Unregister(mod)
		}(i)
	}

	wg.Wait()
	// No data race panic means the test passes (covered by go test -race).
}
