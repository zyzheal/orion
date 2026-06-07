package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// mockWORMStore is a simple in-memory WORM store for testing.
type mockWORMStore struct {
	entries map[string]*AuditEntry
	order   []string
}

func newMockWORMStore() *mockWORMStore {
	return &mockWORMStore{
		entries: make(map[string]*AuditEntry),
		order:   []string{},
	}
}

func (m *mockWORMStore) Write(ctx context.Context, entry *AuditEntry) error {
	if _, exists := m.entries[entry.ID]; exists {
		return fmt.Errorf("duplicate entry: %s", entry.ID)
	}
	m.entries[entry.ID] = entry
	m.order = append(m.order, entry.ID)
	return nil
}

func (m *mockWORMStore) Read(ctx context.Context, id string) (*AuditEntry, error) {
	entry, ok := m.entries[id]
	if !ok {
		return nil, fmt.Errorf("not found: %s", id)
	}
	return entry, nil
}

func (m *mockWORMStore) List(ctx context.Context, tenantID string, limit, offset int) ([]*AuditEntry, error) {
	var result []*AuditEntry
	for _, id := range m.order {
		entry := m.entries[id]
		if tenantID != "" && entry.TenantID != tenantID {
			continue
		}
		result = append(result, entry)
		if limit > 0 && len(result) >= limit {
			break
		}
	}
	return result, nil
}

func (m *mockWORMStore) ListByTimeRange(ctx context.Context, tenantID string, from, to time.Time) ([]*AuditEntry, error) {
	var result []*AuditEntry
	for _, id := range m.order {
		entry := m.entries[id]
		if tenantID != "" && entry.TenantID != tenantID {
			continue
		}
		if entry.Timestamp.Before(from) || entry.Timestamp.After(to) {
			continue
		}
		result = append(result, entry)
	}
	return result, nil
}

func (m *mockWORMStore) Count(ctx context.Context, tenantID string) (int, error) {
	count := 0
	for _, entry := range m.entries {
		if tenantID != "" && entry.TenantID != tenantID {
			continue
		}
		count++
	}
	return count, nil
}

func (m *mockWORMStore) VerifyIntegrity(ctx context.Context, tenantID string) (*VerificationResult, error) {
	return &VerificationResult{Valid: true}, nil
}

func TestLogSyncer_SendHTTP(t *testing.T) {
	var received int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var entries []*AuditEntry
		if err := json.NewDecoder(r.Body).Decode(&entries); err != nil {
			t.Errorf("decode error: %v", err)
			w.WriteHeader(400)
			return
		}
		atomic.AddInt32(&received, int32(len(entries)))
		w.WriteHeader(200)
	}))
	defer server.Close()

	store := newMockWORMStore()
	for i := 0; i < 5; i++ {
		_ = store.Write(context.Background(), &AuditEntry{
			ID:        fmt.Sprintf("entry-%d", i),
			TenantID:  "t1",
			Timestamp: time.Now().Add(time.Duration(-5+i) * time.Minute),
			Action:    "test",
			Resource:  "test",
		})
	}

	syncer := NewLogSyncer(store, LogSyncConfig{
		Enabled:      true,
		Target:       "http",
		Endpoint:     server.URL,
		BatchSize:    10,
		SyncInterval: 1 * time.Hour,
	})

	err := syncer.SyncNow(context.Background())
	if err != nil {
		t.Fatalf("sync error: %v", err)
	}

	got := atomic.LoadInt32(&received)
	if got != 5 {
		t.Errorf("expected 5 entries received, got %d", got)
	}

	stats := syncer.GetStats()
	if stats.TotalSynced != 5 {
		t.Errorf("expected 5 synced, got %d", stats.TotalSynced)
	}
	if stats.BatchesSent != 1 {
		t.Errorf("expected 1 batch, got %d", stats.BatchesSent)
	}
}

func TestLogSyncer_SendHTTP_Batching(t *testing.T) {
	var batches int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var entries []*AuditEntry
		json.NewDecoder(r.Body).Decode(&entries)
		atomic.AddInt32(&batches, 1)
		w.WriteHeader(200)
	}))
	defer server.Close()

	store := newMockWORMStore()
	for i := 0; i < 25; i++ {
		_ = store.Write(context.Background(), &AuditEntry{
			ID:        fmt.Sprintf("entry-%d", i),
			TenantID:  "t1",
			Timestamp: time.Now().Add(time.Duration(-25+i) * time.Minute),
			Action:    "test",
			Resource:  "test",
		})
	}

	syncer := NewLogSyncer(store, LogSyncConfig{
		Enabled:      true,
		Target:       "http",
		Endpoint:     server.URL,
		BatchSize:    10,
		SyncInterval: 1 * time.Hour,
	})

	err := syncer.SyncNow(context.Background())
	if err != nil {
		t.Fatalf("sync error: %v", err)
	}

	got := atomic.LoadInt32(&batches)
	if got != 3 { // 10 + 10 + 5
		t.Errorf("expected 3 batches, got %d", got)
	}
}

func TestLogSyncer_Retry(t *testing.T) {
	var attempts int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := atomic.AddInt32(&attempts, 1)
		if count < 3 {
			w.WriteHeader(500)
			return
		}
		w.WriteHeader(200)
	}))
	defer server.Close()

	store := newMockWORMStore()
	_ = store.Write(context.Background(), &AuditEntry{
		ID:        "entry-1",
		TenantID:  "t1",
		Timestamp: time.Now(),
		Action:    "test",
		Resource:  "test",
	})

	syncer := NewLogSyncer(store, LogSyncConfig{
		Enabled:      true,
		Target:       "http",
		Endpoint:     server.URL,
		BatchSize:    100,
		SyncInterval: 1 * time.Hour,
		MaxRetries:   3,
		RetryDelay:   10 * time.Millisecond,
	})

	err := syncer.SyncNow(context.Background())
	if err != nil {
		t.Fatalf("expected success after retries, got: %v", err)
	}

	got := atomic.LoadInt32(&attempts)
	if got != 3 {
		t.Errorf("expected 3 attempts, got %d", got)
	}
}

func TestLogSyncer_Disabled(t *testing.T) {
	store := newMockWORMStore()
	syncer := NewLogSyncer(store, LogSyncConfig{
		Enabled: false,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	syncer.StartSync(ctx)

	stats := syncer.GetStats()
	if stats.TotalSynced != 0 {
		t.Errorf("expected 0 synced when disabled, got %d", stats.TotalSynced)
	}
}

func TestLogSyncer_AuthToken(t *testing.T) {
	var gotToken string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotToken = r.Header.Get("Authorization")
		w.WriteHeader(200)
	}))
	defer server.Close()

	store := newMockWORMStore()
	_ = store.Write(context.Background(), &AuditEntry{
		ID:        "entry-1",
		TenantID:  "t1",
		Timestamp: time.Now(),
		Action:    "test",
		Resource:  "test",
	})

	syncer := NewLogSyncer(store, LogSyncConfig{
		Enabled:      true,
		Target:       "http",
		Endpoint:     server.URL,
		AuthToken:    "test-token-123",
		SyncInterval: 1 * time.Hour,
	})

	_ = syncer.SyncNow(context.Background())

	if gotToken != "Bearer test-token-123" {
		t.Errorf("expected 'Bearer test-token-123', got '%s'", gotToken)
	}
}

func TestLogSyncer_Elasticsearch(t *testing.T) {
	var contentType string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		contentType = r.Header.Get("Content-Type")
		w.WriteHeader(200)
		w.Write([]byte(`{"errors": false}`))
	}))
	defer server.Close()

	store := newMockWORMStore()
	_ = store.Write(context.Background(), &AuditEntry{
		ID:        "entry-1",
		TenantID:  "t1",
		Timestamp: time.Now(),
		Action:    "test",
		Resource:  "test",
	})

	syncer := NewLogSyncer(store, LogSyncConfig{
		Enabled:      true,
		Target:       "elasticsearch",
		Endpoint:     server.URL,
		IndexName:    "test-audit",
		SyncInterval: 1 * time.Hour,
	})

	err := syncer.SyncNow(context.Background())
	if err != nil {
		t.Fatalf("elasticsearch sync error: %v", err)
	}

	if contentType != "application/x-ndjson" {
		t.Errorf("expected ndjson content type, got %s", contentType)
	}
}
