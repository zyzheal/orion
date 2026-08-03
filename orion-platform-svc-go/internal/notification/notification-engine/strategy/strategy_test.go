package strategy

import (
	"context"
	"sync"
	"testing"
	"time"

	"orion/platform-svc-go/internal/notification/notification-engine"
	"orion/platform-svc-go/internal/notification/notification-engine/testutil"
	"orion/platform-svc-go/internal/notification/notification/models"
)

// ---------------------------------------------------------------------------
// Test factories
// ---------------------------------------------------------------------------

func newTestFactory() *engine.NotifyHandlerFactory {
	return engine.NewNotifyHandlerFactory()
}

// ---------------------------------------------------------------------------
// SingleChannelStrategy tests
// ---------------------------------------------------------------------------

func TestSingleChannelStrategy_Type(t *testing.T) {
	s := NewSingleChannelStrategy()
	if s.Type() != StrategySingle {
		t.Errorf("expected StrategySingle, got %v", s.Type())
	}
}

func TestSingleChannelStrategy_EmptyChain(t *testing.T) {
	s := NewSingleChannelStrategy()
	_, err := s.Execute(context.Background(), testutil.NewTestMessage(), nil)
	if err == nil {
		t.Error("expected error for empty chain")
	}
}

func TestSingleChannelStrategy_FirstSuccessWins(t *testing.T) {
	factory := newTestFactory()

	factory.Register(testutil.NewTestHandler(models.ChannelEmail))

	s := NewSingleChannelStrategyWithFactory(factory)
	results, err := s.Execute(context.Background(), testutil.NewTestMessage(),
		[]models.ChannelType{models.ChannelEmail})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if !results[0].Success {
		t.Error("expected success")
	}
}

func TestSingleChannelStrategy_SkipsUnhealthy(t *testing.T) {
	factory := newTestFactory()

	unhealthy := testutil.NewTestHandler(models.ChannelEmail)
	unhealthy.SetHealthy(false)
	healthy := testutil.NewTestHandler(models.ChannelSlack)

	factory.Register(unhealthy)
	_ = healthy // will be registered below

	s := NewSingleChannelStrategyWithFactory(factory)
	// Register both in the factory
	s.factory.Register(unhealthy)
	s.factory.Register(healthy)

	results, err := s.Execute(context.Background(), testutil.NewTestMessage(),
		[]models.ChannelType{models.ChannelEmail, models.ChannelSlack})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	// Should have used slack since email was unhealthy
	if results[0].MessageID != "test-test-msg-001" {
		t.Errorf("unexpected messageID: %s", results[0].MessageID)
	}
}

func TestSingleChannelStrategy_MetricsTracking(t *testing.T) {
	factory := newTestFactory()
	factory.Register(testutil.NewTestHandler(models.ChannelEmail))

	s := NewSingleChannelStrategyWithFactory(factory)
	_, _ = s.Execute(context.Background(), testutil.NewTestMessage(),
		[]models.ChannelType{models.ChannelEmail})

	// Metrics should show one Get call
	m := factory.Metrics()
	if m.GetCount < 1 {
		t.Errorf("expected GetCount >= 1, got %d", m.GetCount)
	}
}

// ---------------------------------------------------------------------------
// BatchStrategy tests
// ---------------------------------------------------------------------------

func TestBatchStrategy_Type(t *testing.T) {
	s := NewBatchStrategy()
	if s.Type() != StrategyBatch {
		t.Errorf("expected StrategyBatch, got %v", s.Type())
	}
}

func TestBatchStrategy_EmptyChain(t *testing.T) {
	s := NewBatchStrategy()
	_, err := s.Execute(context.Background(), testutil.NewTestMessage(), nil)
	if err == nil {
		t.Error("expected error for empty chain")
	}
}

func TestBatchStrategy_ParallelDelivery(t *testing.T) {
	factory := newTestFactory()

	for _, chType := range []models.ChannelType{
		models.ChannelEmail, models.ChannelSlack, models.ChannelWebhook} {
		factory.Register(testutil.NewTestHandler(chType))
	}

	s := NewBatchStrategyWithOptions(BatchOptions{
		Factory:    factory,
		MaxWorkers: 3,
		Logger:     NoopLogger{},
	})

	results, err := s.Execute(context.Background(), testutil.NewTestMessage(),
		[]models.ChannelType{models.ChannelEmail, models.ChannelSlack, models.ChannelWebhook})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(results))
	}

	for i, r := range results {
		if !r.Success {
			t.Errorf("result %d should succeed: %v", i, r.Error)
		}
	}
}

func TestBatchStrategy_PartialFailure(t *testing.T) {
	factory := newTestFactory()

	healthy := testutil.NewTestHandler(models.ChannelEmail)
	unhealthy := testutil.NewTestHandler(models.ChannelSlack)
	unhealthy.SetHealthy(false)

	factory.Register(healthy)
	factory.Register(unhealthy)

	s := NewBatchStrategyWithOptions(BatchOptions{
		Factory:    factory,
		Logger:     NoopLogger{},
	})

	results, err := s.Execute(context.Background(), testutil.NewTestMessage(),
		[]models.ChannelType{models.ChannelEmail, models.ChannelSlack})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}

	// Results are parallel — count success/failure regardless of order
	successCount := 0
	failCount := 0
	for _, r := range results {
		if r.Success {
			successCount++
		} else {
			failCount++
		}
	}
	if successCount != 1 {
		t.Errorf("expected 1 success, got %d", successCount)
	}
	if failCount != 1 {
		t.Errorf("expected 1 failure, got %d", failCount)
	}
}

func TestBatchStrategy_ContextCancellation(t *testing.T) {
	factory := newTestFactory()

	s := NewBatchStrategyWithOptions(BatchOptions{
		Factory:    factory,
		Logger:     NoopLogger{},
	})

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	_, err := s.Execute(ctx, testutil.NewTestMessage(),
		[]models.ChannelType{models.ChannelEmail})
	_ = err
}

// ---------------------------------------------------------------------------
// PriorityStrategy tests
// ---------------------------------------------------------------------------

func TestPriorityStrategy_Type(t *testing.T) {
	s := NewPriorityStrategy()
	if s.Type() != StrategyPriority {
		t.Errorf("expected StrategyPriority, got %v", s.Type())
	}
}

func TestPriorityStrategy_UrgentBroadcastsAll(t *testing.T) {
	factory := newTestFactory()

	for _, chType := range []models.ChannelType{
		models.ChannelEmail, models.ChannelSlack, models.ChannelWebhook} {
		factory.Register(testutil.NewTestHandler(chType))
	}

	batch := NewBatchStrategyWithOptions(BatchOptions{
		Factory:    factory,
		MaxWorkers: 3,
		Logger:     NoopLogger{},
	})

	msg := testutil.NewTestMessage()
	msg.Priority = 2 // urgent

	results, err := batch.Execute(context.Background(), msg,
		[]models.ChannelType{
			models.ChannelEmail, models.ChannelSlack, models.ChannelWebhook})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 3 {
		t.Fatalf("expected 3 results for urgent, got %d", len(results))
	}
	for i, r := range results {
		if !r.Success {
			t.Errorf("urgent result %d should succeed: %v", i, r.Error)
		}
	}
}

// ---------------------------------------------------------------------------
// StrategyFactory tests
// ---------------------------------------------------------------------------

func TestStrategyFactory_RegisterAndGet(t *testing.T) {
	factory := NewStrategyFactory()

	s, ok := factory.Get(StrategySingle)
	if !ok {
		t.Fatal("expected StrategySingle to be registered by default")
	}
	if s.Type() != StrategySingle {
		t.Errorf("wrong type: %v", s.Type())
	}
}

func TestStrategyFactory_All(t *testing.T) {
	factory := NewStrategyFactory()
	types := factory.All()
	if len(types) != 3 {
		t.Errorf("expected 3 strategies, got %d", len(types))
	}
}

func TestStrategyFactory_Metrics(t *testing.T) {
	factory := NewStrategyFactory()
	m := factory.Metrics()
	if m.RegisterCount != 3 {
		t.Errorf("expected 3 registered, got %d", m.RegisterCount)
	}
}

func TestStrategyFactory_GetUnknown(t *testing.T) {
	factory := NewStrategyFactory()
	_, ok := factory.Get("unknown")
	if ok {
		t.Error("expected not found for unknown strategy")
	}
}

func TestStrategyFactory_CustomRegistration(t *testing.T) {
	factory := engine.NewNotifyHandlerFactory()
	_ = factory

	// Custom strategy can be registered
	s := NewSingleChannelStrategyWithFactory(engine.NewNotifyHandlerFactory())
	if s.Type() != StrategySingle {
		t.Errorf("expected StrategySingle, got %v", s.Type())
	}
}

// ---------------------------------------------------------------------------
// NoopLogger tests
// ---------------------------------------------------------------------------

func TestNoopLogger_DoesNotPanic(t *testing.T) {
	log := NoopLogger{}
	log.Info("test", "key", "value")
	log.Warn("test", "key", "value")
	log.Error("test", "key", "value")
}

// ---------------------------------------------------------------------------
// Integration: Dispatch via EngineAdapter
// ---------------------------------------------------------------------------

func TestStrategyIntegration_DispatchViaAdapter(t *testing.T) {
	factory := engine.NewNotifyHandlerFactory()
	adapter := engine.NewEngineAdapter(engine.GlobalPolicyHandlerFactory, factory)

	factory.Register(testutil.NewTestHandler(models.ChannelEmail))

	msg := testutil.NewTestMessage()
	msg.Metadata["channel"] = "email"

	result, err := adapter.DeliverMessage(context.Background(), msg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Success {
		t.Error("expected success")
	}
}

// ---------------------------------------------------------------------------
// Concurrent stress test
// ---------------------------------------------------------------------------

func TestBatchStrategy_ConcurrentStress(t *testing.T) {
	factory := newTestFactory()
	for _, chType := range []models.ChannelType{
		models.ChannelEmail, models.ChannelSlack} {
		factory.Register(testutil.NewTestHandler(chType))
	}

	s := NewBatchStrategyWithOptions(BatchOptions{
		Factory:    factory,
		MaxWorkers: 2,
		Logger:     NoopLogger{},
	})

	var wg sync.WaitGroup
	errChan := make(chan error, 10)

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := s.Execute(context.Background(), testutil.NewTestMessage(),
				[]models.ChannelType{models.ChannelEmail, models.ChannelSlack})
			if err != nil {
				errChan <- err
			}
		}()
	}

	wg.Wait()
	close(errChan)

	var errs []error
	for err := range errChan {
		errs = append(errs, err)
	}
	if len(errs) > 0 {
		t.Errorf("unexpected errors during stress test: %v", errs[0])
	}
}

// ---------------------------------------------------------------------------
// BatchOptions defaults
// ---------------------------------------------------------------------------

func TestBatchOptions_Defaults(t *testing.T) {
	s := NewBatchStrategy()
	if s.maxWorkers != 10 {
		t.Errorf("expected maxWorkers=10, got %d", s.maxWorkers)
	}
	if s.timeout != 30*time.Second {
		t.Errorf("expected timeout=30s, got %v", s.timeout)
	}
}

func TestBatchOptions_ZeroValues(t *testing.T) {
	s := NewBatchStrategyWithOptions(BatchOptions{})
	if s.maxWorkers != 10 {
		t.Errorf("expected default maxWorkers, got %d", s.maxWorkers)
	}
	if s.maxRetries != 3 {
		t.Errorf("expected default maxRetries, got %d", s.maxRetries)
	}
}
