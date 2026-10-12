package script

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	cmdbmodels "orion/platform-svc-go/internal/cmdb/models"
)

// countingExecutor is a fake Executor that returns a fixed status per
// call. It records invocations so tests can assert fan-out behaviour
// (per-target calls, ordering, cancellation propagation).
type countingExecutor struct {
	mu     sync.Mutex
	calls  []string
	Status string
	Output string
	Err    error
	Delay  time.Duration
	Cancel <-chan struct{}
}

func (e *countingExecutor) Type() string { return "bash" }
func (e *countingExecutor) Execute(ctx context.Context, req *ExecRequest) (*ExecResult, error) {
	e.mu.Lock()
	e.calls = append(e.calls, req.CIID)
	e.mu.Unlock()
	if e.Delay > 0 {
		select {
		case <-time.After(e.Delay):
		case <-ctx.Done():
			return &ExecResult{CIID: req.CIID, Status: "failed", Error: "ctx cancelled"}, nil
		}
	}
	if e.Cancel != nil {
		select {
		case <-e.Cancel:
		case <-ctx.Done():
			return &ExecResult{CIID: req.CIID, Status: "failed", Error: "ctx cancelled"}, nil
		}
	}
	if e.Err != nil {
		return nil, e.Err
	}
	return &ExecResult{
		CIID:   req.CIID,
		Status: e.Status,
		Output: e.Output,
	}, nil
}

func (e *countingExecutor) lastCalls() []string {
	e.mu.Lock()
	defer e.mu.Unlock()
	out := make([]string, len(e.calls))
	copy(out, e.calls)
	return out
}

func TestRouter_Execute_NoTargetReturnsErrTargetEmpty(t *testing.T) {
	r := NewRouter()
	_, err := r.Execute(context.Background(), "t1", &cmdbmodels.ScriptExecRequest{
		TargetCiIds: []string{},
		Script:      "echo hi",
	})
	if !errors.Is(err, ErrTargetEmpty) {
		t.Errorf("expected ErrTargetEmpty, got %v", err)
	}
}

func TestRouter_Execute_EmptyScriptBodyRejected(t *testing.T) {
	r := NewRouter()
	_, err := r.Execute(context.Background(), "t1", &cmdbmodels.ScriptExecRequest{
		TargetCiIds: []string{"ci-1"},
		Script:      "   ",
	})
	if !errors.Is(err, ErrScriptBodyEmpty) {
		t.Errorf("expected ErrScriptBodyEmpty, got %v", err)
	}
}

func TestRouter_Execute_UnsupportedTypeRejected(t *testing.T) {
	r := NewRouter()
	_, err := r.Execute(context.Background(), "t1", &cmdbmodels.ScriptExecRequest{
		TargetCiIds: []string{"ci-1"},
		Script:      "x",
		ScriptType:  "powershell",
	})
	if !errors.Is(err, ErrScriptTypeUnsupported) {
		t.Errorf("expected ErrScriptTypeUnsupported, got %v", err)
	}
}

func TestRouter_Execute_WrongTypeFails(t *testing.T) {
	r := NewRouter()
	_, err := r.Execute(context.Background(), "t1", &cmdbmodels.ScriptExecRequest{
		TargetCiIds: []string{"ci-1"},
		Script:      "x",
		ScriptType:  "powershell",
	})
	if !errors.Is(err, ErrScriptTypeUnsupported) {
		t.Errorf("expected ErrScriptTypeUnsupported, got %v", err)
	}
}

func TestRouter_Execute_WhitelistEnforced(t *testing.T) {
	r := NewRouter()
	w := NewWhitelist()
	w.Add("t1", "bash")
	r.WithWhitelist(w)

	_, err := r.Execute(context.Background(), "t1", &cmdbmodels.ScriptExecRequest{
		TargetCiIds: []string{"ci-1"},
		Script:      "echo hi",
		ScriptType:  "python",
	})
	if !errors.Is(err, ErrScriptTypeNotAllowed) {
		t.Errorf("expected ErrScriptTypeNotAllowed, got %v", err)
	}
}

func TestRouter_Execute_WhitelistAllowsRegistered(t *testing.T) {
	r := NewRouter()
	w := NewWhitelist()
	w.Add("t1", "bash")
	r.WithWhitelist(w)

	_, err := r.Execute(context.Background(), "t1", &cmdbmodels.ScriptExecRequest{
		TargetCiIds: []string{"ci-1"},
		Script:      "echo hello",
		ScriptType:  "bash",
	})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
}

func TestRouter_Execute_NoWhitelistAllowsAll(t *testing.T) {
	r := NewRouter()
	_, err := r.Execute(context.Background(), "t1", &cmdbmodels.ScriptExecRequest{
		TargetCiIds: []string{"ci-1"},
		Script:      "echo hello",
		ScriptType:  "bash",
	})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
}

func TestRouter_Execute_PreservesCIIDOrder(t *testing.T) {
	calls := []string{}
	fake := &stubExecutor{func(ci string) *ExecResult {
		calls = append(calls, ci)
		return &ExecResult{CIID: ci, Status: "success", Output: "ok"}
	}}
	r := NewRouter()
	r.Register("bash", fake)

	req := &cmdbmodels.ScriptExecRequest{
		TargetCiIds: []string{"c-3", "c-1", "c-2"},
		Script:      "echo x",
		ScriptType:  "bash",
	}
	res, err := r.Execute(context.Background(), "t1", req)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	// Sequential mode preserves input order.
	got := make([]string, len(res.Results))
	for i, r := range res.Results {
		got[i] = r.CIID
	}
	want := []string{"c-3", "c-1", "c-2"}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Errorf("expected %v, got %v", want, got)
	}
}

func TestRouter_Execute_CtxCancelMidFanOutMarksCancelled(t *testing.T) {
	fake := &stubExecutor{func(ci string) *ExecResult {
		return &ExecResult{CIID: ci, Status: "success"}
	}}
	r := NewRouter()
	r.Register("bash", fake)

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // pre-cancelled

	res, err := r.Execute(ctx, "t1", &cmdbmodels.ScriptExecRequest{
		TargetCiIds: []string{"c-1", "c-2"},
		Script:      "echo x",
		ScriptType:  "bash",
	})
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if res.Status != "cancelled" {
		t.Errorf("expected cancelled, got %q", res.Status)
	}
}

func TestRouter_Execute_PartialFailureMarkedFailed(t *testing.T) {
	fake := &stubExecutor{func(ci string) *ExecResult {
		if ci == "c-2" {
			return &ExecResult{CIID: ci, Status: "failed", Error: "boom"}
		}
		return &ExecResult{CIID: ci, Status: "success", Output: "ok"}
	}}
	r := NewRouter()
	r.Register("bash", fake)

	res, err := r.Execute(context.Background(), "t1", &cmdbmodels.ScriptExecRequest{
		TargetCiIds: []string{"c-1", "c-2"},
		Script:      "echo x",
		ScriptType:  "bash",
	})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if res.Status != "failed" {
		t.Errorf("expected failed, got %q", res.Status)
	}
	if len(res.Results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(res.Results))
	}
}

func TestRouter_Execute_ParallelFanOutAllTargetsCalled(t *testing.T) {
	fake := &stubExecutor{func(ci string) *ExecResult {
		return &ExecResult{CIID: ci, Status: "success"}
	}}
	r := NewRouter()
	r.Register("bash", fake)
	r.WithParallel(4)

	res, err := r.Execute(context.Background(), "t1", &cmdbmodels.ScriptExecRequest{
		TargetCiIds: []string{"c-1", "c-2", "c-3", "c-4"},
		Script:      "echo x",
		ScriptType:  "bash",
	})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if len(res.Results) != 4 {
		t.Fatalf("expected 4 results, got %d", len(res.Results))
	}
	if res.Status != "completed" {
		t.Errorf("expected completed, got %q", res.Status)
	}
}

func TestRouter_Execute_ExecutorErrSurfacesAsTargetFailed(t *testing.T) {
	fake := &stubExecutor{func(ci string) *ExecResult {
		return nil // nil result signals executor-level failure
	}}
	r := NewRouter()
	r.Register("bash", fake)

	res, err := r.Execute(context.Background(), "t1", &cmdbmodels.ScriptExecRequest{
		TargetCiIds: []string{"c-1"},
		Script:      "echo x",
		ScriptType:  "bash",
	})
	if err != nil {
		// Router returns nil error but marks target failed (defensive).
		t.Fatalf("unexpected err: %v", err)
	}
	if res.Results[0].Status != "failed" {
		t.Errorf("expected failed target, got %+v", res.Results[0])
	}
}

func TestRouter_Execute_ScriptTooLongRejected(t *testing.T) {
	r := NewRouter()
	long := strings.Repeat("echo x\n", MaxScriptBytes)
	_, err := r.Execute(context.Background(), "t1", &cmdbmodels.ScriptExecRequest{
		TargetCiIds: []string{"c-1"},
		Script:      long,
		ScriptType:  "bash",
	})
	if !errors.Is(err, ErrScriptTooLong) {
		t.Errorf("expected ErrScriptTooLong, got %v", err)
	}
}

func TestRouter_Execute_RegisteredExecutorIsUsed(t *testing.T) {
	called := false
	fake := &stubExecutor{func(ci string) *ExecResult {
		called = true
		return &ExecResult{CIID: ci, Status: "success", Output: "from-fake"}
	}}
	r := NewRouter()
	r.Register("bash", fake)

	res, err := r.Execute(context.Background(), "t1", &cmdbmodels.ScriptExecRequest{
		TargetCiIds: []string{"c-1"},
		Script:      "echo x",
		ScriptType:  "bash",
	})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !called {
		t.Error("registered executor was not called")
	}
	if res.Results[0].Output != "from-fake" {
		t.Errorf("expected from-fake output, got %q", res.Results[0].Output)
	}
}

// stubExecutor is a simple Executor wrapper around a callback.
type stubExecutor struct {
	fn func(ci string) *ExecResult
}
func (s *stubExecutor) Type() string { return "bash" }
func (s *stubExecutor) Execute(ctx context.Context, req *ExecRequest) (*ExecResult, error) {
	return s.fn(req.CIID), nil
}
