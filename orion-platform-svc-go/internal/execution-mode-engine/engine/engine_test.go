package engine

import (
	"context"
	"errors"
	"testing"
	"time"

	"go.uber.org/zap"
)

func TestModeIsValid(t *testing.T) {
	tests := []struct {
		mode   Mode
		expect bool
	}{
		{ModeImmediate, true},
		{ModeQueued, true},
		{ModeScheduled, true},
		{ModeManual, true},
		{ModeAPITriggered, true},
		{"bogus", false},
		{"", false},
	}
	for _, tc := range tests {
		t.Run(tc.mode.String(), func(t *testing.T) {
			if got := tc.mode.IsValid(); got != tc.expect {
				t.Errorf("IsValid() = %v, want %v", got, tc.expect)
			}
		})
	}
}

type testHandler struct {
	mode      Mode
	name      string
	result    *ExecutionResult
	err       error
	failCount int
	calls     int
}

func (h *testHandler) Name() string {
	return h.name
}

func (h *testHandler) Handles(mode Mode) bool {
	return mode == h.mode
}

func (h *testHandler) Handle(_ context.Context, req *ExecutionRequest) (*ExecutionResult, error) {
	h.calls++
	if h.err != nil && h.calls <= h.failCount {
		return nil, h.err
	}
	return h.result, nil
}

func TestRouterRoute(t *testing.T) {
	logger := zap.NewNop()
	router := newRouterImpl(logger)

	handler := &testHandler{mode: ModeQueued, name: "test-queued"}
	router.RegisterModeHandler(handler)

	req := &ExecutionRequest{Mode: ModeQueued}
	got, err := router.Route(req)
	if err != nil {
		t.Fatalf("Route() returned error: %v", err)
	}
	if got != handler {
		t.Fatalf("Route() = %v, want %v", got, handler)
	}
}

func TestRouterRouteMissing(t *testing.T) {
	logger := zap.NewNop()
	router := newRouterImpl(logger)

	req := &ExecutionRequest{Mode: ModeQueued}
	_, err := router.Route(req)
	if !errors.Is(err, ErrModeNotImplemented) {
		t.Errorf("Route() = %v, want ErrModeNotImplemented", err)
	}
}

func TestRouterFallbackModes(t *testing.T) {
	logger := zap.NewNop()
	router := newRouterImpl(logger)

	router.RegisterModeHandler(&testHandler{mode: ModeQueued, name: "q"})
	router.RegisterModeHandler(&testHandler{mode: ModeImmediate, name: "i"})

	// Request is immediate, so fallback should exclude immediate.
	req := &ExecutionRequest{Mode: ModeImmediate}
	fallbacks := router.FallbackModes(req)

	if len(fallbacks) == 0 {
		t.Fatalf("FallbackModes() returned empty")
	}
	for _, m := range fallbacks {
		if m == ModeImmediate {
			t.Errorf("fallback includes current mode: %s", m)
		}
	}
}

func TestRouterRegisteredModes(t *testing.T) {
	logger := zap.NewNop()
	router := newRouterImpl(logger)
	router.RegisterModeHandler(&testHandler{mode: ModeScheduled, name: "s"})
	modes := router.RegisteredModes()
	if len(modes) != 1 || modes[0] != ModeScheduled {
		t.Errorf("RegisteredModes() = %v, want [scheduled]", modes)
	}
}

func TestNewEngineNilLogger(t *testing.T) {
	eng := NewEngine(Config{}, nil)
	if eng == nil {
		t.Fatal("NewEngine returned nil")
	}
	// Ensure it doesn't panic on basic calls.
	eng.RegisteredModes()
	eng.Stats()
}

func TestEngineExecuteNilRequest(t *testing.T) {
	eng := NewEngine(Config{}, zap.NewNop())
	_, err := eng.Execute(context.Background(), nil)
	if err == nil {
		t.Fatal("Execute(nil) should fail")
	}
}

func TestEngineExecuteInvalidMode(t *testing.T) {
	eng := NewEngine(Config{}, zap.NewNop())
	req := &ExecutionRequest{Mode: "invalid"}
	_, err := eng.Execute(context.Background(), req)
	if !errors.Is(err, ErrUnknownMode) {
		t.Errorf("Execute(invalid mode) = %v, want ErrUnknownMode", err)
	}
}

func TestEngineExecuteNoHandler(t *testing.T) {
	eng := NewEngine(Config{}, zap.NewNop())
	req := &ExecutionRequest{Mode: ModeQueued}
	_, err := eng.Execute(context.Background(), req)
	if !errors.Is(err, ErrModeNotImplemented) {
		t.Errorf("Execute(no handler) = %v, want ErrModeNotImplemented", err)
	}
}

func TestEngineExecuteSuccess(t *testing.T) {
	eng := NewEngine(Config{}, zap.NewNop())
	handler := &testHandler{
		mode: ModeImmediate,
		name: "immediate",
		result: &ExecutionResult{Status: StatusSuccess},
	}
	eng.RegisterHandler(handler)

	req := &ExecutionRequest{
		ID:   "req-1",
		Mode: ModeImmediate,
	}
	result, err := eng.Execute(context.Background(), req)
	if err != nil {
		t.Fatalf("Execute() = %v", err)
	}
	if result.Status != StatusSuccess {
		t.Errorf("result.Status = %v, want %v", result.Status, StatusSuccess)
	}
	if handler.calls != 1 {
		t.Errorf("handler called %d times, want 1", handler.calls)
	}
}

func TestEngineExecuteRetrySuccess(t *testing.T) {
	eng := NewEngine(Config{}, zap.NewNop())
	handler := &testHandler{
		mode:      ModeQueued,
		name:      "queued",
		err:       errors.New("transient failure"),
		failCount: 2, // fail 2 times then succeed
		result:    &ExecutionResult{Status: StatusSuccess},
	}
	eng.RegisterHandler(handler)

	req := &ExecutionRequest{
		ID:       "req-retry",
		Mode:     ModeQueued,
		RetryMax: 3,
	}
	result, err := eng.Execute(context.Background(), req)
	if err != nil {
		t.Fatalf("Execute() = %v", err)
	}
	if result.Status != StatusSuccess {
		t.Errorf("result.Status = %v, want %v", result.Status, StatusSuccess)
	}
	// 3 attempts: fail, fail, succeed
	if handler.calls != 3 {
		t.Errorf("handler called %d times, want 3", handler.calls)
	}
}

func TestEngineExecuteRetryExhausted(t *testing.T) {
	eng := NewEngine(Config{}, zap.NewNop())
	handler := &testHandler{
		mode:      ModeManual,
		name:      "manual",
		err:       errors.New("permanent failure"),
		failCount: 10,
	}
	eng.RegisterHandler(handler)

	req := &ExecutionRequest{
		ID:       "req-exhaust",
		Mode:     ModeManual,
		RetryMax: 1,
	}
	result, err := eng.Execute(context.Background(), req)
	if err == nil {
		t.Fatalf("Execute() expected error, got nil")
	}
	if result == nil || result.Status != "" {
		// result may be nil on permanent failure
	}
	// 2 attempts: fail, fail
	if handler.calls != 2 {
		t.Errorf("handler called %d times, want 2", handler.calls)
	}
}

func TestEngineExecuteFallback(t *testing.T) {
	eng := NewEngine(Config{EnableFallback: true}, zap.NewNop())

	// Primary handler always fails.
	eng.RegisterHandler(&testHandler{
		mode:      ModeImmediate,
		name:      "immediate",
		err:       errors.New("immediate down"),
		failCount: 100,
	})

	// Fallback handler succeeds.
	eng.RegisterHandler(&testHandler{
		mode:   ModeQueued,
		name:   "queued",
		result: &ExecutionResult{Status: StatusSuccess},
	})

	req := &ExecutionRequest{
		ID:    "req-fallback",
		Mode:  ModeImmediate,
		Timeout: 100 * time.Millisecond,
	}
	result, err := eng.Execute(context.Background(), req)
	if err != nil {
		t.Fatalf("Execute() with fallback = %v", err)
	}
	if result.Status != StatusSuccess {
		t.Errorf("result.Status = %v, want %v", result.Status, StatusSuccess)
	}
}

func TestEngineExecuteFallbackExhausted(t *testing.T) {
	eng := NewEngine(Config{EnableFallback: true}, zap.NewNop())

	eng.RegisterHandler(&testHandler{
		mode:      ModeImmediate,
		name:      "immediate",
		err:       errors.New("down"),
		failCount: 100,
	})
	eng.RegisterHandler(&testHandler{
		mode:      ModeQueued,
		name:      "queued",
		err:       errors.New("down"),
		failCount: 100,
	})

	req := &ExecutionRequest{
		ID:    "req-exhaust-fallback",
		Mode:  ModeImmediate,
		Timeout: 5 * time.Second,
	}
	_, err := eng.Execute(context.Background(), req)
	if !errors.Is(err, ErrFallbackExhausted) {
		t.Errorf("expected ErrFallbackExhausted, got %v", err)
	}
}

func TestEngineResolveTenant(t *testing.T) {
	eng := NewEngine(Config{}, zap.NewNop())
	eng.RegisterHandler(&testHandler{
		mode:   ModeAPITriggered,
		name:   "api",
		result: &ExecutionResult{Status: StatusSuccess},
	})

	ctx := context.WithValue(context.Background(), "tenant_id", "tenant-abc")
	req := &ExecutionRequest{Mode: ModeAPITriggered}
	_, err := eng.Execute(ctx, req)
	if err != nil {
		t.Fatalf("Execute() = %v", err)
	}
	if req.TenantID != "tenant-abc" {
		t.Errorf("TenantID = %q, want %q", req.TenantID, "tenant-abc")
	}
}

func TestEngineResolveTenantFallback(t *testing.T) {
	eng := NewEngine(Config{}, zap.NewNop())
	eng.RegisterHandler(&testHandler{
		mode:   ModeQueued,
		name:   "queued",
		result: &ExecutionResult{Status: StatusSuccess},
	})

	req := &ExecutionRequest{Mode: ModeQueued}
	_, err := eng.Execute(context.Background(), req)
	if err != nil {
		t.Fatalf("Execute() = %v", err)
	}
	if req.TenantID != "system" {
		t.Errorf("TenantID = %q, want %q", req.TenantID, "system")
	}
}

func TestEngineTimeout(t *testing.T) {
	eng := NewEngine(Config{DefaultTimeout: 10 * time.Millisecond}, zap.NewNop())

	slowHandler := &testHandler{
		mode:      ModeScheduled,
		name:      "slow",
		err:       context.DeadlineExceeded,
		failCount: 1,
	}
	eng.RegisterHandler(slowHandler)

	req := &ExecutionRequest{
		ID:    "req-timeout",
		Mode:  ModeScheduled,
	}
	_, err := eng.Execute(context.Background(), req)
	if err == nil {
		t.Fatal("Execute() expected error due to timeout")
	}
}

func TestEngineStats(t *testing.T) {
	eng := NewEngine(Config{}, zap.NewNop())
	eng.RegisterHandler(&testHandler{
		mode:   ModeImmediate,
		name:   "immediate",
		result: &ExecutionResult{Status: StatusSuccess},
	})

	req := &ExecutionRequest{ID: "req-stats", Mode: ModeImmediate}
	_, _ = eng.Execute(context.Background(), req)

	stats := eng.Stats()
	if len(stats) == 0 {
		t.Fatalf("Stats() returned empty")
	}
	immediateStats, ok := stats["immediate"]
	if !ok {
		t.Fatalf("Stats() missing immediate")
	}
	if immediateStats.SuccessCalls != 1 {
		t.Errorf("SuccessCalls = %d, want 1", immediateStats.SuccessCalls)
	}
}
