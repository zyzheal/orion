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

// ──────────────────────────────────────────────────────────────────────────────
// LogSyncService tests
// ──────────────────────────────────────────────────────────────────────────────

func TestLogSyncService_Sync(t *testing.T) {
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

	service := NewLogSyncService(server.URL, 10, 1*time.Hour)

	entries := []AuditEntry{
		{ID: "e1", TenantID: "t1", Timestamp: time.Now()},
		{ID: "e2", TenantID: "t1", Timestamp: time.Now()},
	}

	err := service.Sync(context.Background(), entries)
	if err != nil {
		t.Fatalf("Sync failed: %v", err)
	}

	// 2 entries < batchSize(10), so they should be buffered
	if atomic.LoadInt32(&received) != 0 {
		t.Errorf("expected 0 received (buffered), got %d", atomic.LoadInt32(&received))
	}
	if service.BufferSize() != 2 {
		t.Errorf("expected 2 buffered, got %d", service.BufferSize())
	}
}

func TestLogSyncService_Sync_FlushOnBatchSize(t *testing.T) {
	var received int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var entries []*AuditEntry
		json.NewDecoder(r.Body).Decode(&entries)
		atomic.AddInt32(&received, int32(len(entries)))
		w.WriteHeader(200)
	}))
	defer server.Close()

	service := NewLogSyncService(server.URL, 5, 1*time.Hour) // batch size 5

	// Send 5 entries to trigger flush
	entries := make([]AuditEntry, 5)
	for i := range entries {
		entries[i] = AuditEntry{ID: fmt.Sprintf("e%d", i), TenantID: "t1", Timestamp: time.Now()}
	}

	err := service.Sync(context.Background(), entries)
	if err != nil {
		t.Fatalf("Sync failed: %v", err)
	}

	if atomic.LoadInt32(&received) != 5 {
		t.Errorf("expected 5 received (flushed), got %d", atomic.LoadInt32(&received))
	}
	if service.BufferSize() != 0 {
		t.Errorf("expected 0 buffered after flush, got %d", service.BufferSize())
	}

	stats := service.GetStats()
	if stats.TotalSynced != 5 {
		t.Errorf("expected 5 synced, got %d", stats.TotalSynced)
	}
	if stats.BatchesSent != 1 {
		t.Errorf("expected 1 batch sent, got %d", stats.BatchesSent)
	}
}

func TestLogSyncService_BatchSync(t *testing.T) {
	var received int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var entries []*AuditEntry
		json.NewDecoder(r.Body).Decode(&entries)
		atomic.AddInt32(&received, int32(len(entries)))
		w.WriteHeader(200)
	}))
	defer server.Close()

	service := NewLogSyncService(server.URL, 100, 50*time.Millisecond)

	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	// Add entries that won't trigger immediate flush
	entries := []AuditEntry{
		{ID: "e1", TenantID: "t1", Timestamp: time.Now()},
		{ID: "e2", TenantID: "t1", Timestamp: time.Now()},
	}
	_ = service.Sync(ctx, entries)

	// Start batch sync in background
	go service.StartBatchSync(ctx, 50*time.Millisecond)

	// Wait for context to expire
	<-ctx.Done()

	// Should have flushed via batch sync
	got := atomic.LoadInt32(&received)
	if got != 2 {
		t.Errorf("expected 2 entries flushed by batch sync, got %d", got)
	}
}

func TestLogSyncService_Stop(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
	defer server.Close()

	service := NewLogSyncService(server.URL, 100, 1*time.Hour)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	done := make(chan struct{})
	go func() {
		service.StartBatchSync(ctx, 1*time.Hour)
		close(done)
	}()

	// Stop should cause StartBatchSync to return
	service.Stop()

	select {
	case <-done:
		// success
	case <-time.After(1 * time.Second):
		t.Error("StartBatchSync did not return after Stop()")
	}
}

func TestLogSyncService_SendError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
		w.Write([]byte("server error"))
	}))
	defer server.Close()

	service := NewLogSyncService(server.URL, 1, 1*time.Hour) // batch size 1 to trigger immediate send

	entries := []AuditEntry{
		{ID: "e1", TenantID: "t1", Timestamp: time.Now()},
	}

	err := service.Sync(context.Background(), entries)
	if err == nil {
		t.Error("expected error for 500 response")
	}

	stats := service.GetStats()
	if stats.TotalFailed != 1 {
		t.Errorf("expected 1 failed, got %d", stats.TotalFailed)
	}
	if stats.LastError == "" {
		t.Error("expected last error to be set")
	}
}

func TestLogSyncService_DefaultConfig(t *testing.T) {
	service := NewLogSyncService("http://localhost", 0, 0)

	if service.batchSize != 100 {
		t.Errorf("expected default batch size 100, got %d", service.batchSize)
	}
	if service.interval != 30*time.Second {
		t.Errorf("expected default interval 30s, got %v", service.interval)
	}
}
