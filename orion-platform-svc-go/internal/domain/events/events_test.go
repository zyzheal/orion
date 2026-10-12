package events

import (
	"context"
	"encoding/json"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// fakeEvent implements DomainEvent with preconfigured getters/setters.
type fakeEvent struct {
	aggType    string
	aggID      string
	evType     string
	tenantID   string
	occurredAt time.Time
	version    int
}

func (e *fakeEvent) AggregateType() string    { return e.aggType }
func (e *fakeEvent) AggregateID() string      { return e.aggID }
func (e *fakeEvent) TenantID() string         { return e.tenantID }
func (e *fakeEvent) EventType() string        { return e.evType }
func (e *fakeEvent) OccurredAt() time.Time    { return e.occurredAt }
func (e *fakeEvent) Version() int             { return e.version }
func (e *fakeEvent) SetAggregateID(id string) { e.aggID = id }
func (e *fakeEvent) SetTenantID(id string)    { e.tenantID = id }
func (e *fakeEvent) SetVersion(v int)         { e.version = v }

// funcHandler is a DomainEvent-compatible adapter so tests can specify Handle
// behavior via a plain func field.
type funcHandler struct {
	eventTypes []string
	handle     func(ctx context.Context, e DomainEvent) error
}

func (h *funcHandler) Handle(ctx context.Context, event DomainEvent) error {
	return h.handle(ctx, event)
}
func (h *funcHandler) Supports() []string { return h.eventTypes }

// =============== BaseDomainEvent ===============

func TestNewBaseDomainEvent_PopulatesAllFields(t *testing.T) {
	when := time.Date(2024, 5, 17, 10, 30, 0, 0, time.UTC)
	e := NewBaseDomainEvent("pipeline", "p-1", "pipeline.created", "tenant-1", when, 7)

	if e.AggregateType() != "pipeline" {
		t.Errorf("AggregateType = %q", e.AggregateType())
	}
	if e.AggregateID() != "p-1" {
		t.Errorf("AggregateID = %q", e.AggregateID())
	}
	if e.EventType() != "pipeline.created" {
		t.Errorf("EventType = %q", e.EventType())
	}
	if e.TenantID() != "tenant-1" {
		t.Errorf("TenantID = %q", e.TenantID())
	}
	if !e.OccurredAt().Equal(when) {
		t.Errorf("OccurredAt = %v, want %v", e.OccurredAt(), when)
	}
	if e.Version() != 7 {
		t.Errorf("Version = %d", e.Version())
	}
}

func TestBaseDomainEvent_Setters(t *testing.T) {
	e := NewBaseDomainEvent("a", "b", "c", "d", time.Now(), 1)

	e.SetAggregateID("z")
	e.SetTenantID("zz")
	e.SetVersion(99)

	if e.AggregateID() != "z" || e.TenantID() != "zz" || e.Version() != 99 {
		t.Errorf("setters failed: %v %v %d", e.AggregateID(), e.TenantID(), e.Version())
	}
}

func TestBaseDomainEvent_JSONRoundtrip(t *testing.T) {
	when := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	e := PipelineCreatedEvent{
		BaseDomainEvent: NewBaseDomainEvent("pipeline", "p-1", "pipeline.created", "t", when, 1),
		PipelineName:    "build",
	}
	e.CorrelationID = "corr-1"
	e.CausationID = "cause-1"

	b, err := json.Marshal(&e)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var got PipelineCreatedEvent
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.AggregateType() != "pipeline" || got.AggregateID() != "p-1" {
		t.Errorf("aggregate = %q %q", got.AggregateType(), got.AggregateID())
	}
	if got.EventType() != "pipeline.created" {
		t.Errorf("event = %q", got.EventType())
	}
	if got.PipelineName != "build" {
		t.Errorf("name = %q", got.PipelineName)
	}
	if got.CorrelationID != "corr-1" || got.CausationID != "cause-1" {
		t.Errorf("correlation/cause = %q %q", got.CorrelationID, got.CausationID)
	}
}

// =============== MarshalDomainEvent / UnmarshalDomainEvent ===============

func TestMarshalDomainEvent_Happy(t *testing.T) {
	e := &fakeEvent{aggType: "a", aggID: "b", evType: "c", tenantID: "t"}
	b, err := MarshalDomainEvent(e)
	if err != nil {
		t.Fatal(err)
	}
	if len(b) == 0 {
		t.Error("empty JSON output")
	}
}

func TestUnmarshalDomainEvent_Happy(t *testing.T) {
	src := []byte(`{"aggregate_type":"pipeline","aggregate_id":"p-1","event_type":"pipeline.created","tenant_id":"t","occurred_at":"2024-01-01T00:00:00Z","version":1}`)
	target := &BaseInMemoryEvent{}
	if err := UnmarshalDomainEvent(src, target); err != nil {
		t.Fatal(err)
	}
	if target.AggregateType() != "pipeline" {
		t.Errorf("AggregateType = %q", target.AggregateType())
	}
	if target.Version() != 1 {
		t.Errorf("Version = %d", target.Version())
	}
}

func TestUnmarshalDomainEvent_InvalidJSON(t *testing.T) {
	target := &BaseInMemoryEvent{}
	if err := UnmarshalDomainEvent([]byte("{invalid"), target); err == nil {
		t.Error("expected error for invalid JSON")
	}
}

// =============== InMemoryEventPublisher ===============

func TestInMemoryPublisher_PublishDeliversToHandlers(t *testing.T) {
	p := NewInMemoryEventPublisher()
	var done atomic.Bool
	h := &funcHandler{
		eventTypes: []string{"pipeline.created"},
		handle: func(ctx context.Context, _ DomainEvent) error {
			done.Store(true)
			return nil
		},
	}
	p.Subscribe("pipeline.created", h)

	ev := &fakeEvent{
		aggType: "pipeline", aggID: "p-1",
		evType: "pipeline.created", tenantID: "t",
		occurredAt: time.Now(),
	}
	if err := p.Publish(context.Background(), ev); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(500 * time.Millisecond)
	for !done.Load() && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if !done.Load() {
		t.Error("handler was not called within 500ms")
	}
}

func TestInMemoryPublisher_PublishBatch(t *testing.T) {
	p := NewInMemoryEventPublisher()
	var count atomic.Int64
	h := &funcHandler{
		eventTypes: []string{"pipeline.created"},
		handle: func(ctx context.Context, _ DomainEvent) error {
			count.Add(1)
			return nil
		},
	}
	p.Subscribe("pipeline.created", h)

	evs := []DomainEvent{
		&fakeEvent{evType: "pipeline.created", occurredAt: time.Now(), tenantID: "t", aggID: "1"},
		&fakeEvent{evType: "pipeline.created", occurredAt: time.Now(), tenantID: "t", aggID: "2"},
		&fakeEvent{evType: "pipeline.created", occurredAt: time.Now(), tenantID: "t", aggID: "3"},
	}
	if err := p.PublishBatch(context.Background(), evs); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(500 * time.Millisecond)
	for count.Load() < 3 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if count.Load() != 3 {
		t.Errorf("handler calls = %d, want 3", count.Load())
	}
}

func TestInMemoryPublisher_PublishBatch_Empty(t *testing.T) {
	p := NewInMemoryEventPublisher()
	if err := p.PublishBatch(context.Background(), nil); err != nil {
		t.Fatal(err)
	}
	if err := p.PublishBatch(context.Background(), []DomainEvent{}); err != nil {
		t.Fatal(err)
	}
}

func TestInMemoryPublisher_Unsubscribe(t *testing.T) {
	p := NewInMemoryEventPublisher()
	h := &funcHandler{eventTypes: []string{"x"}, handle: func(context.Context, DomainEvent) error { return nil }}
	p.Subscribe("x", h)
	if p.HandlerCount("x") != 1 {
		t.Errorf("count = %d, want 1", p.HandlerCount("x"))
	}
	p.Unsubscribe("x", h)
	if p.HandlerCount("x") != 0 {
		t.Errorf("after unsub count = %d, want 0", p.HandlerCount("x"))
	}
	// Unsubscribing an unknown handler should be a no-op, not a panic.
	p.Unsubscribe("x", &funcHandler{eventTypes: []string{"x"}, handle: func(context.Context, DomainEvent) error { return nil }})
	if p.HandlerCount("x") != 0 {
		t.Errorf("unknown unsub count = %d", p.HandlerCount("x"))
	}
}

func TestInMemoryPublisher_HandlerIsolation(t *testing.T) {
	p := NewInMemoryEventPublisher()
	var aCount, bCount atomic.Int64
	a := &funcHandler{
		eventTypes: []string{"x"},
		handle: func(context.Context, DomainEvent) error { aCount.Add(1); return nil },
	}
	b := &funcHandler{
		eventTypes: []string{"x"},
		handle: func(context.Context, DomainEvent) error { bCount.Add(1); return nil },
	}
	p.Subscribe("x", a)
	p.Subscribe("x", b)
	if p.HandlerCount("x") != 2 {
		t.Errorf("count = %d, want 2", p.HandlerCount("x"))
	}
	p.Publish(context.Background(), &fakeEvent{evType: "x", occurredAt: time.Now(), tenantID: "t"})
	deadline := time.Now().Add(500 * time.Millisecond)
	for (aCount.Load() < 1 || bCount.Load() < 1) && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if aCount.Load() != 1 || bCount.Load() != 1 {
		t.Errorf("a=%d b=%d, want both=1", aCount.Load(), bCount.Load())
	}
}

func TestInMemoryPublisher_UnsubscribeOnlyMatchingHandler(t *testing.T) {
	p := NewInMemoryEventPublisher()
	var kept atomic.Int64
	removed := &funcHandler{
		eventTypes: []string{"x"},
		handle:     func(context.Context, DomainEvent) error { return nil },
	}
	keptH := &funcHandler{
		eventTypes: []string{"x"},
		handle:     func(context.Context, DomainEvent) error { kept.Add(1); return nil },
	}

	p.Subscribe("x", removed)
	p.Subscribe("x", keptH)
	p.Unsubscribe("x", removed)

	if p.HandlerCount("x") != 1 {
		t.Errorf("count after unsub = %d", p.HandlerCount("x"))
	}
	p.Publish(context.Background(), &fakeEvent{evType: "x", occurredAt: time.Now(), tenantID: "t"})
	deadline := time.Now().Add(500 * time.Millisecond)
	for kept.Load() < 1 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if kept.Load() != 1 {
		t.Errorf("kept calls = %d, want 1", kept.Load())
	}
}

// =============== concurrency ===============

func TestInMemoryPublisher_ConcurrentSubscribePublish(t *testing.T) {
	p := NewInMemoryEventPublisher()
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			h := &funcHandler{
				eventTypes: []string{"x"},
				handle:     func(context.Context, DomainEvent) error { return nil },
			}
			p.Subscribe("x", h)
			p.Publish(context.Background(), &fakeEvent{evType: "x", occurredAt: time.Now(), tenantID: "t"})
			time.Sleep(time.Millisecond)
			p.Unsubscribe("x", h)
		}()
	}
	wg.Wait()
}

func TestBaseInMemoryEvent_ConstructsEvent(t *testing.T) {
	when := time.Now()
	e := NewBaseInMemoryEvent("pipeline", "p", "pipeline.created", "t", when, 5)
	if e.AggregateType() != "pipeline" || e.AggregateID() != "p" {
		t.Errorf("aggregate = %q %q", e.AggregateType(), e.AggregateID())
	}
	if e.EventType() != "pipeline.created" {
		t.Errorf("type = %q", e.EventType())
	}
	if e.Version() != 5 {
		t.Errorf("version = %d", e.Version())
	}
}

// Compile-time assertions.
var _ DomainEvent = (*fakeEvent)(nil)
var _ EventHandler = (*funcHandler)(nil)
