package audit

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// LogSyncer syncs audit entries to an independent log server.
// Supports Elasticsearch, Loki, and generic HTTP log receivers.
type LogSyncer struct {
	store    WORMStore
	config   LogSyncConfig
	client   *http.Client
	mu       sync.Mutex
	lastSync time.Time
	stats    SyncStats
}

// LogSyncConfig holds log sync configuration.
type LogSyncConfig struct {
	// Enabled enables log syncing. Default: false.
	Enabled bool `json:"enabled"`
	// Target is the log server type: "elasticsearch", "loki", "http". Default: "http".
	Target string `json:"target"`
	// Endpoint is the log server URL (e.g., "http://localhost:9200/audit-logs").
	Endpoint string `json:"endpoint"`
	// BatchSize is the number of entries per sync batch. Default: 100.
	BatchSize int `json:"batch_size"`
	// SyncInterval is how often to sync. Default: 30 seconds.
	SyncInterval time.Duration `json:"sync_interval"`
	// AuthToken is the Bearer token for the log server. Optional.
	AuthToken string `json:"auth_token,omitempty"`
	// IndexName is the Elasticsearch index name. Default: "orion-audit-logs".
	IndexName string `json:"index_name,omitempty"`
	// TenantID filters sync to a specific tenant. Empty = all tenants.
	TenantID string `json:"tenant_id,omitempty"`
	// MaxRetries is the max retry count on failure. Default: 3.
	MaxRetries int `json:"max_retries"`
	// RetryDelay is the delay between retries. Default: 5 seconds.
	RetryDelay time.Duration `json:"retry_delay"`
}

// SyncStats tracks sync statistics.
type SyncStats struct {
	TotalSynced   int64     `json:"total_synced"`
	TotalFailed   int64     `json:"total_failed"`
	LastError     string    `json:"last_error,omitempty"`
	LastErrorAt   time.Time `json:"last_error_at,omitempty"`
	LastSyncAt    time.Time `json:"last_sync_at"`
	BatchesSent   int64     `json:"batches_sent"`
}

// LogServer is the interface for sending audit logs to a remote server.
type LogServer interface {
	// SendBatch sends a batch of audit entries to the log server.
	SendBatch(ctx context.Context, entries []*AuditEntry) error
	// Health checks if the log server is reachable.
	Health(ctx context.Context) error
}

// NewLogSyncer creates a new log syncer.
func NewLogSyncer(store WORMStore, config LogSyncConfig) *LogSyncer {
	if config.BatchSize == 0 {
		config.BatchSize = 100
	}
	if config.SyncInterval == 0 {
		config.SyncInterval = 30 * time.Second
	}
	if config.Target == "" {
		config.Target = "http"
	}
	if config.IndexName == "" {
		config.IndexName = "orion-audit-logs"
	}
	if config.MaxRetries == 0 {
		config.MaxRetries = 3
	}
	if config.RetryDelay == 0 {
		config.RetryDelay = 5 * time.Second
	}

	return &LogSyncer{
		store:  store,
		config: config,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

// StartSync starts the background sync loop.
func (s *LogSyncer) StartSync(ctx context.Context) {
	if !s.config.Enabled {
		return
	}

	ticker := time.NewTicker(s.config.SyncInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.syncOnce(ctx)
		}
	}
}

// SyncNow triggers an immediate sync.
func (s *LogSyncer) SyncNow(ctx context.Context) error {
	return s.syncOnce(ctx)
}

// GetStats returns current sync statistics.
func (s *LogSyncer) GetStats() SyncStats {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.stats
}

func (s *LogSyncer) syncOnce(ctx context.Context) error {
	s.mu.Lock()
	since := s.lastSync
	s.mu.Unlock()

	// Fetch entries since last sync
	entries, err := s.fetchNewEntries(ctx, since)
	if err != nil {
		s.recordError(fmt.Errorf("fetch entries: %w", err))
		return err
	}

	if len(entries) == 0 {
		s.mu.Lock()
		s.lastSync = time.Now()
		s.mu.Unlock()
		return nil
	}

	// Send in batches
	for i := 0; i < len(entries); i += s.config.BatchSize {
		end := i + s.config.BatchSize
		if end > len(entries) {
			end = len(entries)
		}
		batch := entries[i:end]

		if err := s.sendBatchWithRetry(ctx, batch); err != nil {
			s.recordError(err)
			return err
		}

		s.mu.Lock()
		s.stats.BatchesSent++
		s.stats.TotalSynced += int64(len(batch))
		s.mu.Unlock()
	}

	s.mu.Lock()
	s.lastSync = time.Now()
	s.stats.LastSyncAt = s.lastSync
	s.mu.Unlock()

	return nil
}

func (s *LogSyncer) fetchNewEntries(ctx context.Context, since time.Time) ([]*AuditEntry, error) {
	if since.IsZero() {
		// First sync: fetch last hour
		since = time.Now().Add(-1 * time.Hour)
	}

	if s.config.TenantID != "" {
		return s.store.ListByTimeRange(ctx, s.config.TenantID, since, time.Now())
	}

	// For all tenants, we need a different approach
	// Use List with a large limit as a fallback
	return s.store.List(ctx, "", s.config.BatchSize*10, 0)
}

func (s *LogSyncer) sendBatchWithRetry(ctx context.Context, entries []*AuditEntry) error {
	var lastErr error
	for attempt := 0; attempt <= s.config.MaxRetries; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(s.config.RetryDelay):
			}
		}

		lastErr = s.sendBatch(ctx, entries)
		if lastErr == nil {
			return nil
		}
	}
	return fmt.Errorf("max retries exceeded: %w", lastErr)
}

func (s *LogSyncer) sendBatch(ctx context.Context, entries []*AuditEntry) error {
	switch s.config.Target {
	case "elasticsearch":
		return s.sendElasticsearch(ctx, entries)
	case "loki":
		return s.sendLoki(ctx, entries)
	case "http":
		return s.sendHTTP(ctx, entries)
	default:
		return fmt.Errorf("unsupported log target: %s", s.config.Target)
	}
}

// sendElasticsearch sends entries to Elasticsearch using bulk API.
func (s *LogSyncer) sendElasticsearch(ctx context.Context, entries []*AuditEntry) error {
	var buf bytes.Buffer
	for _, entry := range entries {
		// Bulk action line
		action := map[string]interface{}{
			"index": map[string]string{
				"_index": s.config.IndexName,
				"_id":    entry.ID,
			},
		}
		actionJSON, _ := json.Marshal(action)
		buf.Write(actionJSON)
		buf.WriteByte('\n')

		// Document line
		docJSON, _ := json.Marshal(entry)
		buf.Write(docJSON)
		buf.WriteByte('\n')
	}

	req, err := http.NewRequestWithContext(ctx, "POST",
		s.config.Endpoint+"/_bulk", &buf)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-ndjson")
	if s.config.AuthToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.config.AuthToken)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("send to elasticsearch: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("elasticsearch returned %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// sendLoki sends entries to Grafana Loki using the push API.
func (s *LogSyncer) sendLoki(ctx context.Context, entries []*AuditEntry) error {
	// Build Loki streams
	streams := []lokiStream{
		{
			Stream: map[string]string{
				"job":      "orion-audit",
				"tenant":   s.config.TenantID,
				"source":   "orion-auth-svc",
			},
			Values: make([][]string, 0, len(entries)),
		},
	}

	for _, entry := range entries {
		entryJSON, _ := json.Marshal(entry)
		ts := fmt.Sprintf("%d", entry.Timestamp.UnixNano())
		streams[0].Values = append(streams[0].Values, []string{ts, string(entryJSON)})
	}

	payload := lokiPushRequest{Streams: streams}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal loki payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST",
		s.config.Endpoint+"/loki/api/v1/push", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if s.config.AuthToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.config.AuthToken)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("send to loki: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("loki returned %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// sendHTTP sends entries to a generic HTTP log receiver.
func (s *LogSyncer) sendHTTP(ctx context.Context, entries []*AuditEntry) error {
	payload, err := json.Marshal(entries)
	if err != nil {
		return fmt.Errorf("marshal entries: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST",
		s.config.Endpoint, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if s.config.AuthToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.config.AuthToken)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("send to http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("http returned %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

func (s *LogSyncer) recordError(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.stats.TotalFailed++
	s.stats.LastError = err.Error()
	s.stats.LastErrorAt = time.Now()
}

// Loki types
type lokiPushRequest struct {
	Streams []lokiStream `json:"streams"`
}

type lokiStream struct {
	Stream map[string]string `json:"stream"`
	Values [][]string        `json:"values"`
}

// ──────────────────────────────────────────────────────────────────────────────
// LogSyncService — Direct entry push with buffering
// ──────────────────────────────────────────────────────────────────────────────

// LogSyncService provides a higher-level interface for syncing audit entries
// to an independent log server. Unlike LogSyncer which pulls from a WORMStore,
// LogSyncService accepts entries directly via Sync() and buffers them for
// batch sending.
type LogSyncService struct {
	endpoint  string
	batchSize int
	interval  time.Duration
	client    *http.Client
	buffer    []*AuditEntry
	mu        sync.Mutex
	stopCh    chan struct{}
	stopped   bool
	stats     SyncStats
}

// NewLogSyncService creates a new log sync service.
// endpoint: the log server URL (e.g., "http://log-server:8080/api/audit/ingest").
// batchSize: max entries per batch (default 100).
// interval: flush interval for background sync (default 30s).
func NewLogSyncService(endpoint string, batchSize int, interval time.Duration) *LogSyncService {
	if batchSize <= 0 {
		batchSize = 100
	}
	if interval <= 0 {
		interval = 30 * time.Second
	}
	return &LogSyncService{
		endpoint:  endpoint,
		batchSize: batchSize,
		interval:  interval,
		client:    &http.Client{Timeout: 30 * time.Second},
		stopCh:    make(chan struct{}),
	}
}

// Sync pushes entries to the log server. Entries are buffered and flushed
// when the buffer exceeds batchSize.
func (s *LogSyncService) Sync(ctx context.Context, entries []AuditEntry) error {
	s.mu.Lock()
	for i := range entries {
		entry := entries[i] // copy to avoid holding reference to caller's slice
		s.buffer = append(s.buffer, &entry)
	}
	shouldFlush := len(s.buffer) >= s.batchSize
	var toSend []*AuditEntry
	if shouldFlush {
		toSend = s.buffer
		s.buffer = nil
	}
	s.mu.Unlock()

	if shouldFlush && len(toSend) > 0 {
		return s.sendBatch(ctx, toSend)
	}
	return nil
}

// StartBatchSync starts a background goroutine that periodically flushes the buffer.
// Runs until the context is cancelled or Stop() is called.
func (s *LogSyncService) StartBatchSync(ctx context.Context, interval time.Duration) {
	flushInterval := s.interval
	if interval > 0 {
		flushInterval = interval
	}
	ticker := time.NewTicker(flushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			s.flushBuffer(context.Background())
			return
		case <-s.stopCh:
			s.flushBuffer(context.Background())
			return
		case <-ticker.C:
			s.mu.Lock()
			toSend := s.buffer
			s.buffer = nil
			s.mu.Unlock()

			if len(toSend) > 0 {
				_ = s.sendBatch(context.Background(), toSend)
			}
		}
	}
}

// Stop gracefully stops the background sync and flushes remaining entries.
func (s *LogSyncService) Stop() {
	s.mu.Lock()
	if !s.stopped {
		s.stopped = true
		close(s.stopCh)
	}
	s.mu.Unlock()
}

// GetStats returns current sync statistics.
func (s *LogSyncService) GetStats() SyncStats {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.stats
}

// BufferSize returns the current number of buffered entries.
func (s *LogSyncService) BufferSize() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.buffer)
}

func (s *LogSyncService) sendBatch(ctx context.Context, entries []*AuditEntry) error {
	payload, err := json.Marshal(entries)
	if err != nil {
		return fmt.Errorf("marshal entries: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", s.endpoint, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		s.mu.Lock()
		s.stats.TotalFailed += int64(len(entries))
		s.stats.LastError = err.Error()
		s.stats.LastErrorAt = time.Now()
		s.mu.Unlock()
		return fmt.Errorf("send batch: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		errMsg := fmt.Errorf("server returned %d: %s", resp.StatusCode, string(body))
		s.mu.Lock()
		s.stats.TotalFailed += int64(len(entries))
		s.stats.LastError = errMsg.Error()
		s.stats.LastErrorAt = time.Now()
		s.mu.Unlock()
		return errMsg
	}

	s.mu.Lock()
	s.stats.TotalSynced += int64(len(entries))
	s.stats.BatchesSent++
	s.stats.LastSyncAt = time.Now()
	s.mu.Unlock()

	return nil
}

func (s *LogSyncService) flushBuffer(ctx context.Context) {
	s.mu.Lock()
	toSend := s.buffer
	s.buffer = nil
	s.mu.Unlock()

	if len(toSend) > 0 {
		_ = s.sendBatch(ctx, toSend)
	}
}
