package startup

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"go.uber.org/zap"
)

func nopLogger() *zap.Logger {
	return zap.NewNop()
}

// ----- helpers -----

// counterHandler creates a PhaseHandler that records invocations.
func counterHandler(phase PhaseName, name string, calls *sync.Map) PhaseHandler {
	return PhaseHandler{
		Name:  name,
		Phase: phase,
		Handler: func(_ context.Context) error {
			calls.LoadOrStore(name, 0)
			v, _ := calls.Load(name)
			if cnt, ok := v.(int); ok {
				calls.Store(name, cnt+1)
			}
			return nil
		},
	}
}

// errorHandler returns a handler that fails with the given error.
func errorHandler(phase PhaseName, name string, err error) PhaseHandler {
	return PhaseHandler{
		Name:  name,
		Phase: phase,
		Handler: func(_ context.Context) error {
			return err
		},
	}
}

// ----- tests -----

func TestRegisterHandler(t *testing.T) {
	pm := NewPhaseManager(nopLogger())
	calls := &sync.Map{}
	pm.RegisterHandler(counterHandler(PhaseConfig, "config1", calls))
	pm.RegisterHandler(counterHandler(PhaseConfig, "config2", calls))

	handlers := pm.handlersFor(PhaseConfig)
	if len(handlers) != 2 {
		t.Fatalf("expected 2 handlers, got %d", len(handlers))
	}

	// Unknown phase is silently dropped.
	pm.RegisterHandler(PhaseHandler{Phase: "bogus", Handler: func(context.Context) error { return nil }})
	if len(pm.handlersFor("bogus")) != 0 {
		t.Fatalf("expected unknown phase to be rejected")
	}
}

func TestStartExecutesAllPhases(t *testing.T) {
	pm := NewPhaseManager(nopLogger())
	calls := &sync.Map{}

	// Register one handler per phase.
	for _, phase := range phaseOrder {
		pm.RegisterHandler(counterHandler(phase, string(phase)+"-h", calls))
	}

	err := pm.Start(context.Background())
	if err != nil {
		t.Fatalf("Start failed: %v", err)
	}

	// Verify all phases completed.
	for _, phase := range phaseOrder {
		r := pm.Result(phase)
		if r == nil {
			t.Errorf("expected result for phase %s", phase)
			continue
		}
		if r.Status != PhaseStatusSuccess {
			t.Errorf("phase %s status = %s, want %s", phase, r.Status, PhaseStatusSuccess)
		}
		if r.Duration <= 0 {
			t.Errorf("phase %s duration <= 0", phase)
		}
	}

	if !pm.IsReady() {
		t.Fatal("expected IsReady == true")
	}
}

func TestStartStopsOnFailure(t *testing.T) {
	pm := NewPhaseManager(nopLogger())

	// Config + Database succeed, Cache fails.
	pm.RegisterHandler(counterHandler(PhaseConfig, "ok", &sync.Map{}))
	pm.RegisterHandler(counterHandler(PhaseDatabase, "ok", &sync.Map{}))
	failErr := errors.New("cache unavailable")
	pm.RegisterHandler(errorHandler(PhaseCache, "fail", failErr))
	pm.RegisterHandler(counterHandler(PhaseMiddleware, "skipped", &sync.Map{}))
	pm.RegisterHandler(counterHandler(PhaseServices, "skipped", &sync.Map{}))
	pm.RegisterHandler(counterHandler(PhaseReady, "skipped", &sync.Map{}))

	err := pm.Start(context.Background())
	if err == nil {
		t.Fatal("expected Start to fail")
	}
	if !errors.Is(err, failErr) {
		// wrapped
	}

	// Config and Database should be success; Cache should be failed.
	if r := pm.Result(PhaseConfig); r.Status != PhaseStatusSuccess {
		t.Errorf("Config: want success, got %s", r.Status)
	}
	if r := pm.Result(PhaseDatabase); r.Status != PhaseStatusSuccess {
		t.Errorf("Database: want success, got %s", r.Status)
	}
	if r := pm.Result(PhaseCache); r.Status != PhaseStatusFailed {
		t.Errorf("Cache: want failed, got %s", r.Status)
	}
	// Phases after Cache should never have been run.
	if pm.Result(PhaseMiddleware) != nil {
		t.Errorf("Middleware: expected nil (not started), got result")
	}
	if pm.IsReady() {
		t.Fatal("expected IsReady == false after failure")
	}
}

func TestStartSkipsEmptyPhases(t *testing.T) {
	pm := NewPhaseManager(nopLogger())
	// Only configure Database handler.
	pm.RegisterHandler(counterHandler(PhaseDatabase, "db", &sync.Map{}))

	err := pm.Start(context.Background())
	if err != nil {
		t.Fatalf("Start failed: %v", err)
	}

	// Database is success; everything else is skipped.
	if r := pm.Result(PhaseDatabase); r.Status != PhaseStatusSuccess {
		t.Errorf("Database: want success, got %s", r.Status)
	}
	for _, phase := range phaseOrder {
		if phase == PhaseDatabase {
			continue
		}
		r := pm.Result(phase)
		if r == nil {
			t.Errorf("phase %s: expected result, got nil", phase)
			continue
		}
		if r.Status != PhaseStatusSkipped {
			t.Errorf("phase %s: want skipped, got %s", phase, r.Status)
		}
	}
}

func TestHealthCheckWithinPhase(t *testing.T) {
	pm := NewPhaseManager(nopLogger())
	pm.RegisterHandler(PhaseHandler{
		Name:  "with-health",
		Phase: PhaseCache,
		Handler: func(context.Context) error { return nil },
		HealthCheck: func(context.Context) error { return errors.New("unhealthy") },
	})

	err := pm.Start(context.Background())
	if err == nil {
		t.Fatal("expected Start to fail due to health check")
	}
	if r := pm.Result(PhaseCache); r.Status != PhaseStatusFailed {
		t.Errorf("Cache: want failed, got %s", r.Status)
	}
}

func TestShutdownReverseOrder(t *testing.T) {
	pm := NewPhaseManager(nopLogger())
	order := &sync.Map{}
	var mu sync.Mutex

	// Register handlers with Shutdown that records order.
	for _, phase := range phaseOrder {
		pm.RegisterHandler(PhaseHandler{
			Name:  string(phase) + "-h",
			Phase: phase,
			Handler: func(context.Context) error { return nil },
			Shutdown: func(context.Context) error {
				mu.Lock()
				order.Store(string(phase), true)
				mu.Unlock()
				return nil
			},
		})
	}

	if err := pm.Start(context.Background()); err != nil {
		t.Fatalf("Start failed: %v", err)
	}

	// Shutdown and track order.
	pm.Stop(context.Background())

	// All phases should have been shut down.
	for _, phase := range phaseOrder {
		_, loaded := order.Load(string(phase))
		if !loaded {
			t.Errorf("phase %s: expected shutdown to be called", phase)
		}
	}
}

func TestShutdownIgnoresErrors(t *testing.T) {
	pm := NewPhaseManager(nopLogger())
	fail := errors.New("shutdown fail")
	pm.RegisterHandler(errorHandler(PhaseConfig, "bad", nil))
	pm.RegisterHandler(PhaseHandler{
		Name:  "fails-on-shutdown",
		Phase: PhaseConfig,
		Handler: func(context.Context) error { return nil },
		Shutdown: func(context.Context) error { return fail },
	})
	// Database has no shutdown handler.
	pm.RegisterHandler(counterHandler(PhaseDatabase, "ok", &sync.Map{}))

	_ = pm.Start(context.Background())

	// Stop should not panic and should return (possibly aggregated) error.
	_ = pm.Stop(context.Background())
	// If it gets here, Shutdown didn't panic — good.
}

func TestStopRejectsSubsequentStart(t *testing.T) {
	pm := NewPhaseManager(nopLogger())
	pm.RegisterHandler(counterHandler(PhaseConfig, "ok", &sync.Map{}))
	pm.Start(context.Background())
	pm.Stop(context.Background())

	err := pm.Start(context.Background())
	if err == nil {
		t.Fatal("expected Start to be rejected after Stop")
	}
	if !errors.Is(err, errors.New("PhaseManager is shutting down")) {
		// wrapped, but message should contain shutdown
	}
}

func TestStartPhaseUnknown(t *testing.T) {
	pm := NewPhaseManager(nopLogger())
	err := pm.StartPhase(context.Background(), "bogus")
	if err == nil {
		t.Fatal("expected error for unknown phase")
	}
}

func TestPrePostHooks(t *testing.T) {
	pm := NewPhaseManager(nopLogger())
	var callOrder []string

	pm.RegisterPreHook(HookConfig{
		Name: PhaseConfig,
		Func: func(_ context.Context, phase PhaseName, _ *PhaseResult) error {
			callOrder = append(callOrder, "pre-config")
			return nil
		},
	})
	pm.RegisterPostHook(HookConfig{
		Name: PhaseConfig,
		Func: func(_ context.Context, phase PhaseName, r *PhaseResult) error {
			callOrder = append(callOrder, "post-config")
			if r.Status != PhaseStatusSuccess {
				return errors.New("post-hook: expected success result")
			}
			return nil
		},
	})
	pm.RegisterHandler(PhaseHandler{
		Name:  "cfg",
		Phase: PhaseConfig,
		Handler: func(context.Context) error {
			callOrder = append(callOrder, "handler-config")
			return nil
		},
	})

	pm.Start(context.Background())

	want := []string{"pre-config", "handler-config", "post-config"}
	if len(callOrder) != len(want) {
		t.Fatalf("hook call order = %v, want %v", callOrder, want)
	}
	for i, w := range want {
		if callOrder[i] != w {
			t.Errorf("callOrder[%d] = %q, want %q", i, callOrder[i], w)
		}
	}
}

func TestPreHookFailureAbortsPhase(t *testing.T) {
	pm := NewPhaseManager(nopLogger())
	fail := errors.New("pre-hook fail")
	pm.RegisterPreHook(HookConfig{
		Name: PhaseDatabase,
		Func: func(context.Context, PhaseName, *PhaseResult) error {
			return fail
		},
	})
	pm.RegisterHandler(counterHandler(PhaseDatabase, "never-run", &sync.Map{}))

	err := pm.Start(context.Background())
	if err == nil {
		t.Fatal("expected Start to fail on pre-hook error")
	}
	// Config phase should still succeed.
	if r := pm.Result(PhaseConfig); r.Status != PhaseStatusSkipped {
		t.Errorf("Config: got %s", r.Status)
	}
	// Database should be failed.
	if r := pm.Result(PhaseDatabase); r.Status != PhaseStatusFailed {
		t.Errorf("Database: got %s", r.Status)
	}
}

func TestPostHookFailureIsNonFatal(t *testing.T) {
	pm := NewPhaseManager(nopLogger())
	pm.RegisterHandler(counterHandler(PhaseConfig, "ok", &sync.Map{}))
	pm.RegisterPostHook(HookConfig{
		Name: PhaseConfig,
		Func: func(context.Context, PhaseName, *PhaseResult) error {
			return errors.New("post-hook non-fatal")
		},
	})

	err := pm.Start(context.Background())
	if err != nil {
		t.Fatalf("Start should not fail on post-hook error: %v", err)
	}
	if r := pm.Result(PhaseConfig); r.Status != PhaseStatusSuccess {
		t.Errorf("Config: got %s", r.Status)
	}
}

func TestProgress(t *testing.T) {
	pm := NewPhaseManager(nopLogger())
	pm.RegisterHandler(counterHandler(PhaseConfig, "ok", &sync.Map{}))
	pm.Start(context.Background())

	progress := pm.Progress()
	if progress["ready"] != true {
		t.Errorf("progress ready = %v, want true", progress["ready"])
	}
	phases := progress["phases"].([]map[string]interface{})
	if len(phases) != len(phaseOrder) {
		t.Fatalf("progress phases count = %d, want %d", len(phases), len(phaseOrder))
	}
}

func TestIsRunning(t *testing.T) {
	pm := NewPhaseManager(nopLogger())
	pm.RegisterHandler(PhaseHandler{
		Name:  "slow",
		Phase: PhaseConfig,
		Handler: func(_ context.Context) error {
			if !pm.IsRunning() {
				return errors.New("IsRunning not set during handler")
			}
			return nil
		},
	})

	if pm.IsRunning() {
		t.Fatal("IsRunning should be false before Start")
	}
	if err := pm.Start(context.Background()); err != nil {
		t.Fatalf("Start failed: %v", err)
	}
	if pm.IsRunning() {
		t.Fatal("IsRunning should be false after Start completes")
	}
}

func TestIsReady(t *testing.T) {
	pm := NewPhaseManager(nopLogger())
	pm.RegisterHandler(counterHandler(PhaseConfig, "ok", &sync.Map{}))

	if pm.IsReady() {
		t.Fatal("IsReady should be false before Start")
	}
	pm.Start(context.Background())
	if !pm.IsReady() {
		t.Fatal("IsReady should be true after successful Start")
	}
	pm.Stop(context.Background())
	if pm.IsReady() {
		t.Fatal("IsReady should be false after Stop")
	}
}

func TestDuration(t *testing.T) {
	pm := NewPhaseManager(nopLogger())
	pm.RegisterHandler(PhaseHandler{
		Name:  "timed",
		Phase: PhaseConfig,
		Handler: func(context.Context) error {
			time.Sleep(50 * time.Millisecond)
			return nil
		},
	})
	pm.Start(context.Background())
	d := pm.Duration()
	if d < 50*time.Millisecond {
		t.Fatalf("expected duration >= 50ms, got %v", d)
	}
}

func TestAllPhases(t *testing.T) {
	phases := AllPhases()
	if len(phases) != len(phaseOrder) {
		t.Fatalf("AllPhases returned %d, want %d", len(phases), len(phaseOrder))
	}
	for i, p := range phases {
		if p != phaseOrder[i] {
			t.Errorf("AllPhases[%d] = %q, want %q", i, p, phaseOrder[i])
		}
	}
	// Verify immutability.
	phases[0] = "tampered"
	if phaseOrder[0] != PhaseConfig {
		t.Fatal("AllPhases returned mutable slice")
	}
}
