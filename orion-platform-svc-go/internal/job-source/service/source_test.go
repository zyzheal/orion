// Package service_test provides unit tests for adapters, composition, and dispatch.
package service

import (
	"context"
	"encoding/json"
	"sync"
	"testing"
	"time"

	"orion/platform-svc-go/internal/job-source/models"

	"go.uber.org/zap/zaptest"
)

// testAdapter is a minimal IJobSourceAdapter implementation for testing pipelines.
type testAdapter struct {
	name string
	typ  string
}

func (t *testAdapter) Name() string          { return t.name }
func (t *testAdapter) Type() string          { return t.typ }
func (t *testAdapter) Initialize(ctx context.Context, config map[string]string) error { return nil }
func (t *testAdapter) StartListening(ctx context.Context, handler EventHandler) error { return nil }
func (t *testAdapter) Stop() error { return nil }

// ---------------------------------------------------------------------------
// Adapter tests
// ---------------------------------------------------------------------------

func TestWebhookAdapter_Initialize(t *testing.T) {
	logger := zaptest.NewLogger(t)
	cfg := models.DefaultSourceConfig()
	adapter := NewWebhookAdapter(logger, cfg)

	if err := adapter.Initialize(context.Background(), map[string]string{"path": "/hooks/test"}); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}

	if adapter.config.WebhookPath != "/hooks/test" {
		t.Errorf("expected path /hooks/test, got %s", adapter.config.WebhookPath)
	}
}

func TestWebhookAdapter_InitializeDefaults(t *testing.T) {
	logger := zaptest.NewLogger(t)
	adapter := NewWebhookAdapter(logger, models.DefaultSourceConfig())

	if err := adapter.Initialize(context.Background(), nil); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}

	if adapter.config.WebhookPath != "/hooks" {
		t.Errorf("expected default path /hooks, got %s", adapter.config.WebhookPath)
	}
}

func TestWebhookAdapter_TypeAndName(t *testing.T) {
	logger := zaptest.NewLogger(t)
	adapter := NewWebhookAdapter(logger, models.DefaultSourceConfig())

	if adapter.Type() != models.TypeWebhook {
		t.Errorf("expected type %s, got %s", models.TypeWebhook, adapter.Type())
	}

	if adapter.Name() != "webhook" {
		t.Errorf("expected name webhook, got %s", adapter.Name())
	}
}

func TestCronAdapter_InitializeMissingExpr(t *testing.T) {
	logger := zaptest.NewLogger(t)
	adapter := NewCronAdapter(logger, models.DefaultSourceConfig())

	err := adapter.Initialize(context.Background(), map[string]string{})
	if err == nil {
		t.Fatal("expected error for missing cron_expr")
	}
}

func TestCronAdapter_InitializeValid(t *testing.T) {
	logger := zaptest.NewLogger(t)
	adapter := NewCronAdapter(logger, models.DefaultSourceConfig())

	err := adapter.Initialize(context.Background(), map[string]string{"cron_expr": "0 * * * *"})
	if err != nil {
		t.Fatalf("expected nil, got %v", err)
	}

	if adapter.cronExpr != "0 * * * *" {
		t.Errorf("expected 0 * * * *, got %s", adapter.cronExpr)
	}
}

func TestEventAdapter_InitializeMissingType(t *testing.T) {
	logger := zaptest.NewLogger(t)
	adapter := NewEventAdapter(logger, models.DefaultSourceConfig())

	err := adapter.Initialize(context.Background(), map[string]string{})
	if err == nil {
		t.Fatal("expected error for missing event_type")
	}
}

func TestEventAdapter_InitializeValid(t *testing.T) {
	logger := zaptest.NewLogger(t)
	adapter := NewEventAdapter(logger, models.DefaultSourceConfig())

	err := adapter.Initialize(context.Background(), map[string]string{"event_type": "pipeline.completed"})
	if err != nil {
		t.Fatalf("expected nil, got %v", err)
	}

	if adapter.topic != "pipeline.completed" {
		t.Errorf("expected pipeline.completed, got %s", adapter.topic)
	}
}

func TestAPIAdapter_InitializeCustomPath(t *testing.T) {
	logger := zaptest.NewLogger(t)
	adapter := NewAPIAdapter(logger, models.DefaultSourceConfig())

	err := adapter.Initialize(context.Background(), map[string]string{"path": "/api/v2/custom"})
	if err != nil {
		t.Fatalf("expected nil, got %v", err)
	}

	if adapter.path != "/api/v2/custom" {
		t.Errorf("expected /api/v2/custom, got %s", adapter.path)
	}
}

func TestAPIAdapter_TypeAndName(t *testing.T) {
	logger := zaptest.NewLogger(t)
	adapter := NewAPIAdapter(logger, models.DefaultSourceConfig())

	if adapter.Type() != models.TypeAPI {
		t.Errorf("expected type %s, got %s", models.TypeAPI, adapter.Type())
	}
}

// ---------------------------------------------------------------------------
// Dispatcher tests
// ---------------------------------------------------------------------------

func TestDispatcher_RegisterAndCount(t *testing.T) {
	logger := zaptest.NewLogger(t)
	d := NewDispatcher(logger, 0, 10*time.Second)

	c := Consumer(func(ctx context.Context, payload EventPayload) error { return nil })
	d.RegisterConsumer(models.TypeManual, c)

	if d.ListConsumers(models.TypeManual) != 1 {
		t.Errorf("expected 1 consumer, got %d", d.ListConsumers(models.TypeManual))
	}
}

func TestDispatcher_FanOutDispatch(t *testing.T) {
	logger := zaptest.NewLogger(t)
	d := NewDispatcher(logger, 0, 10*time.Second)

	var calls []EventPayload
	var mu sync.Mutex
	c := Consumer(func(ctx context.Context, payload EventPayload) error {
		mu.Lock()
		calls = append(calls, payload)
		mu.Unlock()
		return nil
	})

	d.RegisterConsumer(models.TypeWebhook, c)
	d.RegisterConsumer(models.TypeWebhook, c)

	p := EventPayload{
		Source:   models.TypeWebhook,
		SourceID: "src-1",
		Data:     map[string]interface{}{"key": "value"},
	}

	if err := d.Dispatch(context.Background(), p); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}

	mu.Lock()
	if len(calls) != 2 {
		t.Errorf("expected 2 calls, got %d", len(calls))
	}
	mu.Unlock()
}

func TestDispatcher_WildcardFallback(t *testing.T) {
	logger := zaptest.NewLogger(t)
	d := NewDispatcher(logger, 0, 10*time.Second)

	var called bool
	c := Consumer(func(ctx context.Context, payload EventPayload) error {
		called = true
		return nil
	})

	d.RegisterConsumer("*", c)
	p := EventPayload{Source: "unknown_type"}

	if err := d.Dispatch(context.Background(), p); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}

	if !called {
		t.Error("expected wildcard consumer to be called")
	}
}

func TestDispatcher_NoConsumers(t *testing.T) {
	logger := zaptest.NewLogger(t)
	d := NewDispatcher(logger, 0, 10*time.Second)

	p := EventPayload{Source: "no-match"}
	if err := d.Dispatch(context.Background(), p); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
}

func TestDispatcher_RemoveConsumer(t *testing.T) {
	logger := zaptest.NewLogger(t)
	d := NewDispatcher(logger, 0, 10*time.Second)

	c := Consumer(func(ctx context.Context, payload EventPayload) error { return nil })
	d.RegisterConsumer(models.TypeAPI, c)

	if ok := d.RemoveConsumer(models.TypeAPI, 0); !ok {
		t.Error("expected remove to succeed")
	}

	if d.ListConsumers(models.TypeAPI) != 0 {
		t.Errorf("expected 0 consumers, got %d", d.ListConsumers(models.TypeAPI))
	}

	if ok := d.RemoveConsumer(models.TypeAPI, 0); ok {
		t.Error("expected remove to fail")
	}
}

func TestDispatcher_RetryOnFailure(t *testing.T) {
	logger := zaptest.NewLogger(t)
	d := NewDispatcher(logger, 2, 5*time.Second) // 2 retries = 3 attempts

	attempts := 0
	var mu sync.Mutex
	c := Consumer(func(ctx context.Context, payload EventPayload) error {
		mu.Lock()
		attempts++
		mu.Unlock()
		return json.Unmarshal([]byte("bad json"), &attempts) // always fails
	})

	d.RegisterConsumer(models.TypeManual, c)
	p := EventPayload{Source: models.TypeManual}

	if err := d.Dispatch(context.Background(), p); err == nil {
		t.Fatal("expected error after retries exhausted")
	}

	mu.Lock()
	if attempts != 3 {
		t.Errorf("expected 3 attempts, got %d", attempts)
	}
	mu.Unlock()
}

func TestDispatcher_RetryWithRecovery(t *testing.T) {
	logger := zaptest.NewLogger(t)
	d := NewDispatcher(logger, 3, 5*time.Second) // 3 retries = 4 attempts

	attempts := 0
	var mu sync.Mutex
	c := Consumer(func(ctx context.Context, payload EventPayload) error {
		mu.Lock()
		attempts++
		mu.Unlock()
		if attempts < 2 {
			return json.Unmarshal([]byte("bad"), &attempts)
		}
		return nil
	})

	d.RegisterConsumer(models.TypeManual, c)
	p := EventPayload{Source: models.TypeManual}

	if err := d.Dispatch(context.Background(), p); err != nil {
		t.Fatalf("expected nil after recovery, got %v", err)
	}

	mu.Lock()
	if attempts < 2 {
		t.Errorf("expected at least 2 attempts, got %d", attempts)
	}
	mu.Unlock()
}

func TestDispatcher_CancelledContext(t *testing.T) {
	logger := zaptest.NewLogger(t)
	d := NewDispatcher(logger, 5, 5*time.Second) // many retries

	ctx, cancel := context.WithCancel(context.Background())
	c := Consumer(func(ctx context.Context, payload EventPayload) error {
		cancel() // cancel on first attempt
		return json.Unmarshal([]byte("bad"), &ctx)
	})

	d.RegisterConsumer(models.TypeManual, c)
	p := EventPayload{Source: models.TypeManual}

	if err := d.Dispatch(ctx, p); err == nil {
		t.Fatal("expected error for cancelled context")
	}
}

// ---------------------------------------------------------------------------
// SourceComposer tests
// ---------------------------------------------------------------------------

func TestSourceComposer_RegisterAndGet(t *testing.T) {
	logger := zaptest.NewLogger(t)
	composer := NewSourceComposer(logger)

	chain := models.JobSourceChain{ID: "chain-1", TenantID: "tenant-1", Name: "test-chain", Status: models.SourceStatusActive}
	links := []models.JobSourceChainLink{
		{ChainID: "chain-1", UpstreamID: "src-1", DownstreamID: "src-2", Order: 1},
		{ChainID: "chain-1", UpstreamID: "src-2", DownstreamID: "src-3", Order: 2},
	}

	composer.RegisterChain(chain, links)

	got, ok := composer.GetChain("chain-1")
	if !ok {
		t.Fatal("expected chain to be found")
	}
	if got.ID != "chain-1" {
		t.Errorf("expected chain-1, got %s", got.ID)
	}

	gotLinks, ok := composer.GetLinks("chain-1")
	if !ok {
		t.Fatal("expected links to be found")
	}
	if len(gotLinks) != 2 {
		t.Errorf("expected 2 links, got %d", len(gotLinks))
	}
}

func TestSourceComposer_ListChains(t *testing.T) {
	logger := zaptest.NewLogger(t)
	composer := NewSourceComposer(logger)

	chain := models.JobSourceChain{ID: "chain-1", TenantID: "tenant-1", Name: "test", Status: models.SourceStatusActive}
	composer.RegisterChain(chain, nil)

	chains := composer.ListChains()
	if len(chains) != 1 {
		t.Errorf("expected 1 chain, got %d", len(chains))
	}
}

func TestSourceComposer_UnregisterChain(t *testing.T) {
	logger := zaptest.NewLogger(t)
	composer := NewSourceComposer(logger)

	chain := models.JobSourceChain{ID: "chain-1", TenantID: "tenant-1", Name: "test", Status: models.SourceStatusActive}
	composer.RegisterChain(chain, nil)

	if ok := composer.UnregisterChain("chain-1"); !ok {
		t.Error("expected unregister to succeed")
	}

	if _, ok := composer.GetChain("chain-1"); ok {
		t.Error("expected chain to be gone")
	}

	if ok := composer.UnregisterChain("non-existent"); ok {
		t.Error("expected unregister to fail for non-existent chain")
	}
}

func TestSourceComposer_GetNonExistent(t *testing.T) {
	logger := zaptest.NewLogger(t)
	composer := NewSourceComposer(logger)

	if _, ok := composer.GetChain("non-existent"); ok {
		t.Error("expected chain not found")
	}

	if _, ok := composer.GetLinks("non-existent"); ok {
		t.Error("expected links not found")
	}
}

// ---------------------------------------------------------------------------
// SourceCombinator tests
// ---------------------------------------------------------------------------

func TestSourceCombinator_OR(t *testing.T) {
	logger := zaptest.NewLogger(t)
	combo := NewSourceCombinator("test-or", "OR", logger)
	combo.AddUpstream("src-1")
	combo.AddUpstream("src-2")

	var received EventPayload
	combo.SetHandler(func(ctx context.Context, payload EventPayload) error {
		received = payload
		return nil
	})

	payload := EventPayload{Source: models.TypeWebhook, SourceID: "src-1", Data: map[string]interface{}{"key": "val"}}
	if err := combo.HandleEvent(context.Background(), "src-1", payload); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}

	if received.SourceID != "src-1" {
		t.Errorf("expected src-1, got %s", received.SourceID)
	}
}

func TestSourceCombinator_OR_IgnoresUnknownUpstream(t *testing.T) {
	logger := zaptest.NewLogger(t)
	combo := NewSourceCombinator("test", "OR", logger)
	combo.AddUpstream("src-1")

	var called bool
	combo.SetHandler(func(ctx context.Context, payload EventPayload) error {
		called = true
		return nil
	})

	if err := combo.HandleEvent(context.Background(), "unknown", EventPayload{}); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}

	if called {
		t.Error("expected handler not to be called for unknown upstream")
	}
}

func TestSourceCombinator_SetFilter(t *testing.T) {
	logger := zaptest.NewLogger(t)
	combo := NewSourceCombinator("test", "OR", logger)
	combo.AddUpstream("src-1")

	var called bool
	combo.SetHandler(func(ctx context.Context, payload EventPayload) error {
		called = true
		return nil
	})

	// Invalid filter
	if err := combo.SetFilter("not-json"); err == nil {
		t.Fatal("expected error for invalid JSON")
	}

	// Valid filter that passes
	combo.SetFilter(`{"key":"val"}`)
	payload := EventPayload{Data: map[string]interface{}{"key": "val"}}
	if err := combo.HandleEvent(context.Background(), "src-1", payload); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
	if !called {
		t.Error("expected handler to be called")
	}

	// Valid filter that fails
	called = false
	payload = EventPayload{Data: map[string]interface{}{"other": "val"}}
	if err := combo.HandleEvent(context.Background(), "src-1", payload); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
	if called {
		t.Error("expected handler not to be called after filter fails")
	}
}

func TestSourceCombinator_ListUpstreams(t *testing.T) {
	logger := zaptest.NewLogger(t)
	combo := NewSourceCombinator("test", "AND", logger)
	combo.AddUpstream("src-1")
	combo.AddUpstream("src-2")

	upstreams := combo.ListUpstreams()
	if len(upstreams) != 2 {
		t.Errorf("expected 2 upstreams, got %d", len(upstreams))
	}
}

// ---------------------------------------------------------------------------
// SourcePipeline tests
// ---------------------------------------------------------------------------

func TestSourcePipeline_Process(t *testing.T) {
	logger := zaptest.NewLogger(t)
	pipeline := NewSourcePipeline("test-pipeline", logger)

	pipeline.AddStage(PipelineStage{
		Name:    "stage-1",
		Adapter: &testAdapter{name: "test-adapter", typ: models.TypeManual},
		Filter:  `{"valid":true}`,
	})
	pipeline.AddStage(PipelineStage{
		Name:    "stage-2",
		Adapter: &testAdapter{name: "test-adapter", typ: models.TypeManual},
		Filter:  `{"key":"val"}`,
	})

	var final EventPayload
	pipeline.SetCallback(func(ctx context.Context, payload EventPayload) error {
		final = payload
		return nil
	})

	// Passes both stages
	payload := EventPayload{
		Source: models.TypeManual,
		Data:   map[string]interface{}{"valid": true, "key": "val"},
	}
	if result, err := pipeline.Process(context.Background(), payload); err != nil {
		t.Fatalf("expected nil, got %v", err)
	} else if result == nil {
		t.Fatal("expected non-nil result")
	}

	if final.Data["key"] != "val" {
		t.Errorf("expected key=val, got %v", final.Data)
	}
}

func TestSourcePipeline_FilterOut(t *testing.T) {
	logger := zaptest.NewLogger(t)
	pipeline := NewSourcePipeline("test-filter", logger)
	pipeline.AddStage(PipelineStage{
		Name:    "stage-1",
		Adapter: &testAdapter{name: "test-adapter", typ: models.TypeManual},
		Filter:  `{"required_key":"val"}`,
	})

	payload := EventPayload{Data: map[string]interface{}{}}
	result, err := pipeline.Process(context.Background(), payload)
	if err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
	if result != nil {
		t.Error("expected nil result for filtered event")
	}
}

func TestSourcePipeline_SetCallback(t *testing.T) {
	logger := zaptest.NewLogger(t)
	pipeline := NewSourcePipeline("test-callback", logger)
	pipeline.AddStage(PipelineStage{
		Name:    "stage-1",
		Adapter: &testAdapter{name: "cb-test", typ: models.TypeManual},
	})
	var called bool
	pipeline.SetCallback(func(ctx context.Context, payload EventPayload) error {
		called = true
		return nil
	})

	_, err := pipeline.Process(context.Background(), EventPayload{Source: "cb-test", Data: map[string]interface{}{"key": "val"}})
	if err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
	if !called {
		t.Error("expected callback to be set")
	}
}


// ---------------------------------------------------------------------------
// ChainExecutor tests
// ---------------------------------------------------------------------------

func TestChainExecutor_ExecuteChain(t *testing.T) {
	logger := zaptest.NewLogger(t)
	composer := NewSourceComposer(logger)
	dispatcher := NewDispatcher(logger, 0, 10*time.Second)
	executor := NewChainExecutor(composer, dispatcher, logger)

	chain := models.JobSourceChain{ID: "chain-1", TenantID: "tenant-1", Name: "test-chain", Status: models.SourceStatusActive}
	links := []models.JobSourceChainLink{
		{ChainID: "chain-1", UpstreamID: "src-1", DownstreamID: "src-2", Order: 1},
		{ChainID: "chain-1", UpstreamID: "src-2", DownstreamID: "src-3", Order: 2},
	}
	composer.RegisterChain(chain, links)

	// Register consumers for the downstream sources
	var dispatched []string
	var mu sync.Mutex
	dispatcher.RegisterConsumer("src-2", Consumer(func(ctx context.Context, payload EventPayload) error {
		mu.Lock()
		dispatched = append(dispatched, payload.SourceID)
		mu.Unlock()
		return nil
	}))
	dispatcher.RegisterConsumer("src-3", Consumer(func(ctx context.Context, payload EventPayload) error {
		mu.Lock()
		dispatched = append(dispatched, payload.SourceID)
		mu.Unlock()
		return nil
	}))

	payload := EventPayload{Source: "src-1", Data: map[string]interface{}{"key": "val"}}
	if err := executor.ExecuteChain(context.Background(), "chain-1", payload); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}

	mu.Lock()
	if len(dispatched) != 2 {
		t.Errorf("expected 2 dispatched, got %d", len(dispatched))
	}
	mu.Unlock()
}

func TestChainExecutor_NonExistentChain(t *testing.T) {
	logger := zaptest.NewLogger(t)
	composer := NewSourceComposer(logger)
	dispatcher := NewDispatcher(logger, 0, 10*time.Second)
	executor := NewChainExecutor(composer, dispatcher, logger)

	payload := EventPayload{Source: "src-1"}
	if err := executor.ExecuteChain(context.Background(), "non-existent", payload); err == nil {
		t.Fatal("expected error for non-existent chain")
	}
}

func TestChainExecutor_FilterInLink(t *testing.T) {
	logger := zaptest.NewLogger(t)
	composer := NewSourceComposer(logger)
	dispatcher := NewDispatcher(logger, 0, 10*time.Second)
	executor := NewChainExecutor(composer, dispatcher, logger)

	chain := models.JobSourceChain{ID: "chain-1", TenantID: "tenant-1", Name: "test-chain", Status: models.SourceStatusActive}
	links := []models.JobSourceChainLink{
		{ChainID: "chain-1", UpstreamID: "src-1", DownstreamID: "src-2", Filter: `{"required":"val"}`, Order: 1},
	}
	composer.RegisterChain(chain, links)

	// No data that matches the filter
	payload := EventPayload{Source: "src-1", Data: map[string]interface{}{}}
	if err := executor.ExecuteChain(context.Background(), "chain-1", payload); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
	// The link was filtered, so nothing should be dispatched
}

// ---------------------------------------------------------------------------
// EventRecorder tests
// ---------------------------------------------------------------------------

type mockRepository struct {
	events   []*models.JobSourceEvent
	updated  []string
	mu       sync.Mutex
	tenantID string
}

func (m *mockRepository) Create(ctx context.Context, s *models.JobSource) error { return nil }
func (m *mockRepository) Delete(ctx context.Context, tenantID, id string) error { return nil }
func (m *mockRepository) GetByID(ctx context.Context, tenantID, id string) (*models.JobSource, error) { return nil, nil }
func (m *mockRepository) List(ctx context.Context, tenantID string, limit, offset int) ([]models.JobSource, error) { return nil, nil }
func (m *mockRepository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error { return nil }
func (m *mockRepository) UpdatePartial(ctx context.Context, tenantID, id string, updates map[string]interface{}) error { return nil }
func (m *mockRepository) CreateEvent(ctx context.Context, e *models.JobSourceEvent) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.events = append(m.events, e)
	return nil
}
func (m *mockRepository) UpdateEventStatus(ctx context.Context, tenantID, id string, status string, jobID string, err string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.updated = append(m.updated, id)
	return nil
}
func (m *mockRepository) ListEvents(ctx context.Context, tenantID, sourceID string, limit, offset int) ([]models.JobSourceEvent, error) { return nil, nil }

func TestEventRecorder_RecordReceived(t *testing.T) {
	logger := zaptest.NewLogger(t)
	repo := &mockRepository{}
	recorder := NewEventRecorder(repo, logger)

	payload := EventPayload{Source: models.TypeManual, SourceID: "src-1", Data: map[string]interface{}{"test": "data"}}
	event, err := recorder.RecordReceived(context.Background(), "tenant-1", "src-1", payload)
	if err != nil {
		t.Fatalf("expected nil, got %v", err)
	}

	if event.Status != models.EventStatusReceived {
		t.Errorf("expected received, got %s", event.Status)
	}

	repo.mu.Lock()
	if len(repo.events) != 1 {
		t.Errorf("expected 1 event, got %d", len(repo.events))
	}
	repo.mu.Unlock()
}

func TestEventRecorder_RecordProcessed(t *testing.T) {
	logger := zaptest.NewLogger(t)
	repo := &mockRepository{}
	recorder := NewEventRecorder(repo, logger)

	if err := recorder.RecordProcessed(context.Background(), "tenant-1", "event-1", "job-1"); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}

	repo.mu.Lock()
	if len(repo.updated) != 1 {
		t.Errorf("expected 1 update, got %d", len(repo.updated))
	}
	repo.mu.Unlock()
}

func TestEventRecorder_RecordFailed(t *testing.T) {
	logger := zaptest.NewLogger(t)
	repo := &mockRepository{}
	recorder := NewEventRecorder(repo, logger)

	if err := recorder.RecordFailed(context.Background(), "tenant-1", "event-1", "something went wrong"); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}

	repo.mu.Lock()
	if len(repo.updated) != 1 {
		t.Errorf("expected 1 update, got %d", len(repo.updated))
	}
	repo.mu.Unlock()
}

func TestEventRecorder_RecordDispatched(t *testing.T) {
	logger := zaptest.NewLogger(t)
	repo := &mockRepository{}
	recorder := NewEventRecorder(repo, logger)

	if err := recorder.RecordDispatched(context.Background(), "tenant-1", "event-1", "job-1"); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}

	repo.mu.Lock()
	if len(repo.updated) != 1 {
		t.Errorf("expected 1 update, got %d", len(repo.updated))
	}
	repo.mu.Unlock()
}

// ---------------------------------------------------------------------------
// BridgeConsumer tests
// ---------------------------------------------------------------------------

func TestBridgeConsumer_Consume(t *testing.T) {
	logger := zaptest.NewLogger(t)
	var consumed EventPayload
	var mu sync.Mutex
	handler := Consumer(func(ctx context.Context, payload EventPayload) error {
		mu.Lock()
		consumed = payload
		mu.Unlock()
		return nil
	})

	bridge := NewBridgeConsumer("test-bridge", handler, logger)
	payload := EventPayload{Source: models.TypeWebhook, SourceID: "src-1", Data: map[string]interface{}{"data": "test"}}

	if err := bridge.Consume(context.Background(), payload); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}

	mu.Lock()
	if consumed.SourceID != "src-1" {
		t.Errorf("expected src-1, got %s", consumed.SourceID)
	}
	mu.Unlock()
}

func TestBridgeConsumer_Name(t *testing.T) {
	logger := zaptest.NewLogger(t)
	bridge := NewBridgeConsumer("test-bridge", nil, logger)

	if bridge.Name() != "test-bridge" {
		t.Errorf("expected test-bridge, got %s", bridge.Name())
	}
}

// ---------------------------------------------------------------------------
// Source type validation tests
// ---------------------------------------------------------------------------

func TestValidateSourceType(t *testing.T) {
	valid := []string{models.TypeManual, models.TypeSchedule, models.TypeWebhook, models.TypeAPI, models.TypeCron, models.TypeEventTrigger, models.TypeAlertCallback, models.TypePipelineStep, models.TypeApprovalStep, models.TypeChatCommand}
	for _, v := range valid {
		if !models.ValidateSourceType(v) {
			t.Errorf("expected %s to be valid", v)
		}
	}

	if models.ValidateSourceType("invalid-type") {
		t.Error("expected invalid-type to be invalid")
	}
}

func TestAllSourceTypes(t *testing.T) {
	if len(models.AllSourceTypes) != 10 {
		t.Errorf("expected 10 source types, got %d", len(models.AllSourceTypes))
	}
}

// ---------------------------------------------------------------------------
// Dispatcher defaults
// ---------------------------------------------------------------------------

func TestDispatcher_DefaultRetry(t *testing.T) {
	logger := zaptest.NewLogger(t)
	d := NewDispatcher(logger, -1, 0)
	if d.retry != 0 {
		t.Errorf("expected 0 retries for negative input, got %d", d.retry)
	}
}

func TestDispatcher_DefaultTimeout(t *testing.T) {
	logger := zaptest.NewLogger(t)
	d := NewDispatcher(logger, 0, 0)
	if d.timeout != 10*time.Second {
		t.Errorf("expected 10s timeout for zero input, got %v", d.timeout)
	}
}

// ---------------------------------------------------------------------------
// Compile-time interface checks
// ---------------------------------------------------------------------------

func TestAdapterInterface(t *testing.T) {
	var _ IJobSourceAdapter = (*WebhookAdapter)(nil)
	var _ IJobSourceAdapter = (*CronAdapter)(nil)
	var _ IJobSourceAdapter = (*EventAdapter)(nil)
	var _ IJobSourceAdapter = (*APIAdapter)(nil)
}
