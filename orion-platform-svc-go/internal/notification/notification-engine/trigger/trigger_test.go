package trigger

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"orion/platform-svc-go/internal/notification/models"
	"orion/platform-svc-go/internal/notification/notification-engine"
	"orion/platform-svc-go/internal/notification/notification-engine/testutil"
)

// ---------------------------------------------------------------------------
// EventTrigger tests
// ---------------------------------------------------------------------------

func TestEventTrigger_Type(t *testing.T) {
	tt := NewEventTrigger(EventTriggerConfig{
		Name:      "test-event",
		EventType: "TEST_EVENT",
	})
	if tt.Type() != TriggerEvent {
		t.Errorf("expected TriggerEvent, got %v", tt.Type())
	}
}

func TestEventTrigger_Name(t *testing.T) {
	name := "my-event-trigger"
	tt := NewEventTrigger(EventTriggerConfig{
		Name:      name,
		EventType: "TEST_EVENT",
	})
	if tt.Name() != name {
		t.Errorf("expected name=%s, got %s", name, tt.Name())
	}
}

func TestEventTrigger_Fire(t *testing.T) {
	tt := NewEventTrigger(EventTriggerConfig{
		Name:      "test-event",
		EventType: "TEST_EVENT",
		Logger:    NoopLogger{},
	})
	msgs, err := tt.Fire(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(msgs) != 0 {
		t.Errorf("event trigger should produce 0 messages, got %d", len(msgs))
	}
}

func TestEventTrigger_Stop(t *testing.T) {
	tt := NewEventTrigger(EventTriggerConfig{
		Name:      "test-event",
		EventType: "TEST_EVENT",
	})
	if err := tt.Stop(); err != nil {
		t.Errorf("Stop should not error: %v", err)
	}
}

// ---------------------------------------------------------------------------
// ScheduledTrigger tests
// ---------------------------------------------------------------------------

func TestScheduledTrigger_Type(t *testing.T) {
	cfg := ScheduledTriggerConfig{
		Name:     "test-scheduled",
		Interval: time.Minute,
	}
	tt := NewScheduledTrigger(cfg)
	defer tt.Stop()
	if tt.Type() != TriggerScheduled {
		t.Errorf("expected TriggerScheduled, got %v", tt.Type())
	}
}

func TestScheduledTrigger_OneShot(t *testing.T) {
	produced := make(chan *engine.NotifyMessage, 1)

	cfg := ScheduledTriggerConfig{
		Name:     "test-oneshot",
		OneShot:  true,
		Interval: 100 * time.Millisecond,
		Message:  testutil.NewTestMessage(),
		ExecFunc: func(ctx context.Context) ([]*engine.NotifyMessage, error) {
			m := testutil.NewTestMessage()
			m.ID = "oneshot-msg"
			produced <- m
			return []*engine.NotifyMessage{m}, nil
		},
		Logger: NoopLogger{},
	}
	tt := NewScheduledTrigger(cfg)
	defer tt.Stop()

	select {
	case <-produced:
		// Success — message was produced
	case <-time.After(500 * time.Millisecond):
		t.Error("one-shot message was not produced in time")
	}
}

func TestScheduledTrigger_Periodic(t *testing.T) {
	// ExecFunc is dispatched from the ticker goroutine, so the counter must be
	// atomic; a plain int would race with the assertion read below.
	var counter atomic.Int32

	cfg := ScheduledTriggerConfig{
		Name:     "test-periodic",
		Interval: 50 * time.Millisecond,
		ExecFunc: func(ctx context.Context) ([]*engine.NotifyMessage, error) {
			counter.Add(1)
			return nil, nil
		},
		Logger: NoopLogger{},
	}
	tt := NewScheduledTrigger(cfg)
	time.Sleep(200 * time.Millisecond)
	tt.Stop()

	if n := counter.Load(); n < 2 {
		t.Errorf("expected at least 2 periodic firings, got %d", n)
	}
}

func TestScheduledTrigger_StopWaitsForInFlightExec(t *testing.T) {
	// Stop is a barrier: it must not return while an execution is still running.
	var fired atomic.Bool
	started := make(chan struct{})
	release := make(chan struct{})
	cfg := ScheduledTriggerConfig{
		Name:     "test-barrier",
		Interval: 10 * time.Millisecond,
		ExecFunc: func(ctx context.Context) ([]*engine.NotifyMessage, error) {
			if fired.CompareAndSwap(false, true) {
				close(started)
			}
			<-release
			return nil, nil
		},
		Logger: NoopLogger{},
	}
	tt := NewScheduledTrigger(cfg)

	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("trigger never fired")
	}

	stopDone := make(chan struct{})
	go func() {
		if err := tt.Stop(); err != nil {
			t.Errorf("Stop: %v", err)
		}
		close(stopDone)
	}()
	select {
	case <-stopDone:
		t.Fatal("Stop returned before the in-flight execution finished")
	case <-time.After(50 * time.Millisecond):
	}

	close(release)
	select {
	case <-stopDone:
	case <-time.After(time.Second):
		t.Fatal("Stop did not return after the execution finished")
	}
}

// captureLogger records Error calls so tests can assert on logged failures.
type captureLogger struct {
	errFn func(msg string, fields ...any)
}

func (l captureLogger) Info(string, ...any) {}
func (l captureLogger) Warn(string, ...any) {}
func (l captureLogger) Error(msg string, f ...any) {
	if l.errFn != nil {
		l.errFn(msg, f...)
	}
}

func TestScheduledTrigger_PanickingExecDoesNotEscape(t *testing.T) {
	// A panicking ExecFunc must be contained, not crash the process.
	var panics int32
	release := make(chan struct{})
	logger := captureLogger{errFn: func(msg string, kv ...any) {
		if msg == "scheduled trigger execution panicked" {
			atomic.AddInt32(&panics, 1)
		}
	}}
	cfg := ScheduledTriggerConfig{
		Name:     "test-panic",
		Interval: 10 * time.Millisecond,
		ExecFunc: func(ctx context.Context) ([]*engine.NotifyMessage, error) {
			close(release)
			panic("boom")
		},
		Logger: logger,
	}
	tt := NewScheduledTrigger(cfg)
	select {
	case <-release:
	case <-time.After(time.Second):
		t.Fatal("panicking trigger never fired")
	}
	// Stop drains the panicked run and returns without hanging.
	done := make(chan struct{})
	go func() { tt.Stop(); close(done) }()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("Stop hung after a panicking execution")
	}
	if atomic.LoadInt32(&panics) != 1 {
		t.Errorf("panics logged = %d, want 1", panics)
	}
}

func TestScheduledTrigger_Stop(t *testing.T) {
	cfg := ScheduledTriggerConfig{
		Name:     "test-stop",
		Interval: time.Second,
	}
	tt := NewScheduledTrigger(cfg)
	if err := tt.Stop(); err != nil {
		t.Errorf("Stop should not error: %v", err)
	}
}

func TestScheduledTrigger_DefaultExecFuncNil(t *testing.T) {
	cfg := ScheduledTriggerConfig{
		Name:     "test-default-exec",
		Interval: time.Minute,
		Message:  testutil.NewTestMessage(),
	}
	tt := NewScheduledTrigger(cfg)
	defer tt.Stop()

	msgs, err := tt.Fire(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(msgs) != 1 {
		t.Errorf("expected 1 message, got %d", len(msgs))
	}
}

// ---------------------------------------------------------------------------
// ManualTrigger tests
// ---------------------------------------------------------------------------

func TestManualTrigger_Type(t *testing.T) {
	cfg := ManualTriggerConfig{
		Name:    "test-manual",
		Message: testutil.NewTestMessage(),
	}
	tt := NewManualTrigger(cfg)
	if tt.Type() != TriggerManual {
		t.Errorf("expected TriggerManual, got %v", tt.Type())
	}
}

func TestManualTrigger_Fire(t *testing.T) {
	cfg := ManualTriggerConfig{
		Name:    "test-manual",
		Message: testutil.NewTestMessage(),
		Logger:  NoopLogger{},
	}
	tt := NewManualTrigger(cfg)

	msgs, err := tt.Fire(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(msgs) != 1 {
		t.Errorf("expected 1 message, got %d", len(msgs))
	}
	if msgs[0].ID != "test-msg-001" {
		t.Errorf("wrong message ID: %s", msgs[0].ID)
	}
}

func TestManualTrigger_FireAfterStop(t *testing.T) {
	cfg := ManualTriggerConfig{
		Name:    "test-manual",
		Message: testutil.NewTestMessage(),
	}
	tt := NewManualTrigger(cfg)
	tt.Stop()

	_, err := tt.Fire(context.Background())
	if err == nil {
		t.Error("expected error after stop")
	}
}

func TestManualTrigger_NoMessage(t *testing.T) {
	tt := NewManualTrigger(ManualTriggerConfig{
		Name: "test-no-msg",
	})

	_, err := tt.Fire(context.Background())
	if err == nil {
		t.Error("expected error for no message")
	}
}

func TestManualTrigger_Stop(t *testing.T) {
	cfg := ManualTriggerConfig{
		Name:    "test-stop",
		Message: testutil.NewTestMessage(),
	}
	tt := NewManualTrigger(cfg)
	if err := tt.Stop(); err != nil {
		t.Errorf("Stop should not error: %v", err)
	}
	// Stopping twice should be safe
	if err := tt.Stop(); err != nil {
		t.Errorf("Stop twice should not error: %v", err)
	}
}

// ---------------------------------------------------------------------------
// TriggerFactory tests
// ---------------------------------------------------------------------------

func TestTriggerFactory_RegisterAndGet(t *testing.T) {
	factory := NewTriggerFactory()
	tt := NewManualTrigger(ManualTriggerConfig{
		Name:    "factory-test",
		Message: testutil.NewTestMessage(),
	})
	factory.Register(tt)

	retrieved, ok := factory.Get("factory-test")
	if !ok {
		t.Fatal("trigger not found")
	}
	if retrieved.Name() != "factory-test" {
		t.Errorf("wrong name: %s", retrieved.Name())
	}
}

func TestTriggerFactory_All(t *testing.T) {
	factory := NewTriggerFactory()
	factory.Register(NewManualTrigger(ManualTriggerConfig{Name: "a", Message: testutil.NewTestMessage()}))
	factory.Register(NewManualTrigger(ManualTriggerConfig{Name: "b", Message: testutil.NewTestMessage()}))

	names := factory.All()
	if len(names) != 2 {
		t.Errorf("expected 2 names, got %d", len(names))
	}
}

func TestTriggerFactory_GetUnknown(t *testing.T) {
	factory := NewTriggerFactory()
	_, ok := factory.Get("nonexistent")
	if ok {
		t.Error("expected not found")
	}
}

func TestTriggerFactory_FireAll(t *testing.T) {
	factory := NewTriggerFactory()

	cfg := ManualTriggerConfig{
		Name:    "fireall-test",
		Message: testutil.NewTestMessage(),
	}
	factory.Register(NewManualTrigger(cfg))

	msgs, errs := factory.FireAll(context.Background())
	if len(errs) != 0 {
		t.Fatalf("unexpected errors: %v", errs)
	}
	if len(msgs) != 1 {
		t.Errorf("expected 1 message, got %d", len(msgs))
	}
}

func TestTriggerFactory_FireAllWithError(t *testing.T) {
	factory := NewTriggerFactory()

	// Register a trigger with no message (will error on fire)
	factory.Register(NewManualTrigger(ManualTriggerConfig{
		Name: "error-trigger",
	}))

	_, errs := factory.FireAll(context.Background())
	if len(errs) != 1 {
		t.Fatalf("expected 1 error, got %d", len(errs))
	}
}

func TestTriggerFactory_Unregister(t *testing.T) {
	factory := NewTriggerFactory()
	factory.Register(NewManualTrigger(ManualTriggerConfig{
		Name:    "unreg-test",
		Message: testutil.NewTestMessage(),
	}))

	factory.Unregister("unreg-test")
	_, ok := factory.Get("unreg-test")
	if ok {
		t.Error("trigger should be unregistered")
	}
}

func TestTriggerFactory_Metrics(t *testing.T) {
	_ = NewTriggerFactory()
	factory := NewTriggerFactory()
	m := factory.Metrics()
	if m.RegisterCount != 0 {
		t.Errorf("expected 0 registered, got %d", m.RegisterCount)
	}
}

func TestTriggerFactory_ForEach(t *testing.T) {
	factory := NewTriggerFactory()
	names := []string{}

	factory.Register(NewManualTrigger(ManualTriggerConfig{Name: "a"}))
	factory.Register(NewManualTrigger(ManualTriggerConfig{Name: "b"}))
	factory.ForEach(func(t Trigger) {
		names = append(names, t.Name())
	})

	if len(names) != 2 {
		t.Errorf("expected 2 names, got %d", len(names))
	}
}

// ---------------------------------------------------------------------------
// TriggerBuilder tests
// ---------------------------------------------------------------------------

func TestTriggerBuilder_BuildEvent(t *testing.T) {
	tt := NewTriggerBuilder().
		AsEvent("TEST_EVENT").
		WithName("builder-event").
		Build()

	if tt.Type() != TriggerEvent {
		t.Errorf("expected TriggerEvent, got %v", tt.Type())
	}
	if tt.Name() != "builder-event" {
		t.Errorf("expected name=builder-event, got %s", tt.Name())
	}
}

func TestTriggerBuilder_BuildScheduled(t *testing.T) {
	tt := NewTriggerBuilder().
		AsScheduled(time.Minute).
		WithName("builder-scheduled").
		WithMessage(testutil.NewTestMessage()).
		WithOneShot().
		Build()

	if tt.Type() != TriggerScheduled {
		t.Errorf("expected TriggerScheduled, got %v", tt.Type())
	}
	tt.Stop()
}

func TestTriggerBuilder_BuildManual(t *testing.T) {
	msg := testutil.NewTestMessage()
	tt := NewTriggerBuilder().
		AsManual().
		WithName("builder-manual").
		WithMessage(msg).
		Build()

	if tt.Type() != TriggerManual {
		t.Errorf("expected TriggerManual, got %v", tt.Type())
	}
}

func TestTriggerBuilder_DefaultName(t *testing.T) {
	tt := NewTriggerBuilder().AsManual().Build()
	name := tt.Name()
	if name == "" || name == "trigger-0" {
		t.Errorf("expected auto-generated name, got %s", name)
	}
}

func TestTriggerBuilder_WithLogger(t *testing.T) {
	tt := NewTriggerBuilder().
		AsManual().
		WithName("builder-logger").
		WithLogger(NoopLogger{}).
		Build()

	msgs, err := tt.Fire(context.Background())
	// Should not panic even without message (error expected)
	_ = msgs
	_ = err
}

// ---------------------------------------------------------------------------
// Config serialization tests
// ---------------------------------------------------------------------------

func TestMarshalConfig(t *testing.T) {
	cfg := TriggerConfig{
		Type:       TriggerScheduled,
		Name:       "test-cfg",
		Enabled:    true,
		TenantID:   "tenant-001",
		Channel:    models.ChannelEmail,
		Recipients: []string{"test@example.com"},
		PolicyID:   "policy-001",
		CronExpr:   "0 9 * * *",
	}

	data, err := MarshalConfig(cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	parsed, err := UnmarshalConfig(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if parsed.Name != cfg.Name {
		t.Errorf("name mismatch: %s != %s", parsed.Name, cfg.Name)
	}
	if parsed.Type != cfg.Type {
		t.Errorf("type mismatch: %s != %s", parsed.Type, cfg.Type)
	}
}

func TestUnmarshalConfig_Invalid(t *testing.T) {
	_, err := UnmarshalConfig([]byte("invalid json"))
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
}

// ---------------------------------------------------------------------------
// NoopLogger tests
// ---------------------------------------------------------------------------

func TestNoopLogger(t *testing.T) {
	log := NoopLogger{}
	log.Info("test", "key", "value")
	log.Warn("test", "key", "value")
	log.Error("test", "key", "value")
}
