package script

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"crypto/rand"
	"encoding/hex"

	cmdbmodels "orion/platform-svc-go/internal/cmdb/models"
)

// Router dispatches a multi-target ScriptExecRequest across executors
// and enforces whitelist + length + type checks. It owns the fan-out
// envelope (ExecutionID, overall Status) — individual Executor.Execute
// implementations only see one target at a time.
type Router struct {
	// executors maps scriptType → Executor. Empty Router falls back to
	// LocalExecutor automatically so callers need not register.
	mu        sync.RWMutex
	executors map[string]Executor

	// whitelist is a per-tenant ScriptType allow-list. Nil disables
	// whitelist checking (backward-compat with tests that don't set
	// WithWhitelist).
	whitelist *Whitelist

	// ssh is the optional remote executor; used when ExecRequest.SSH is
	// populated and the caller registered an SSHExecutor via Register.
	ssh Executor

	// targetTimeout caps per-target run. Zero = MaxPerTargetTimeout.
	targetTimeout time.Duration

	// parallel controls whether fan-out runs sequentially (1) or
	// concurrently (N = len(targets)). Default 1 for reproducibility.
	parallel int

	// resolver, if non-nil, resolves CIID → SSHTarget by looking up
	// the CI's ci_type==Host metadata. Called per target before Execute.
	resolver TargetResolver
}

// TargetResolver maps a CIID to its resolved SSH target (nil if the CI
// is not a remote-exec target).
type TargetResolver interface {
	ResolveTarget(ctx context.Context, tenantID, ciID string) (*SSHTarget, error)
}

// NewRouter returns a Router pre-loaded with a LocalExecutor for
// bash/python/terraform so callers can use it without explicit wiring.
func NewRouter() *Router {
	local := NewLocalExecutor()
	return &Router{
		executors: map[string]Executor{
			"bash":      local,
			"sh":        local,
			"python":    local,
			"python3":   local,
			"python2":   local,
			"terraform": local,
		},
		targetTimeout: MaxPerTargetTimeout * time.Millisecond,
		parallel:      1,
	}
}

// NewRouterWithSSH wires an SSHExecutor for remote targets. Callers
// still need to provide a TargetResolver to map CIID → SSHTarget.
func NewRouterWithSSH(sshExec *SSHExecutor, resolver TargetResolver) *Router {
	r := NewRouter()
	r.ssh = sshExec
	r.resolver = resolver
	return r
}

// Register adds or replaces an Executor for a given ScriptType.
func (r *Router) Register(t string, e Executor) {
	if e == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.executors == nil {
		r.executors = make(map[string]Executor)
	}
	r.executors[strings.ToLower(strings.TrimSpace(t))] = e
}

// WithWhitelist installs a Whitelist. Before this call, no whitelist
// checking occurs (backward compat with tests).
func (r *Router) WithWhitelist(w *Whitelist) *Router {
	r.whitelist = w
	return r
}

// WithParallel sets the fan-out concurrency. <=1 means sequential.
func (r *Router) WithParallel(n int) *Router {
	if n < 1 {
		n = 1
	}
	r.parallel = n
	return r
}

// WithTargetTimeout overrides the per-target timeout.
func (r *Router) WithTargetTimeout(d time.Duration) *Router {
	if d > 0 {
		r.targetTimeout = d
	}
	return r
}

// Execute runs the request. Fan-out runs sequentially by default.
// Overall Status:
//   - "completed" when every target returns status=="success" or the
//     request has no targets.
//   - "failed" when at least one target returns status=="failed" or
//     validation fails per-target.
//   - "cancelled" if ctx is cancelled before/during fan-out.
//
// Validation errors at the request level (empty script, unsupported
// script type, empty targets, script too long) are returned as an
// error and short-circuit — the caller gets a single error, not a
// partial result.
func (r *Router) Execute(ctx context.Context, tenantID string, req *cmdbmodels.ScriptExecRequest) (*cmdbmodels.ScriptExecResult, error) {
	if req == nil {
		return nil, ErrScriptBodyEmpty
	}
	if len(req.TargetCiIds) == 0 {
		return nil, ErrTargetEmpty
	}
	scriptType, err := ValidateScriptType(req.ScriptType)
	if err != nil {
		return nil, err
	}
	body := strings.TrimSpace(req.Script)
	if body == "" {
		return nil, ErrScriptBodyEmpty
	}
	if len(body) > MaxScriptBytes {
		return nil, ErrScriptTooLong
	}
	if r.whitelist != nil && !r.whitelist.Allow(tenantID, scriptType) {
		return nil, fmt.Errorf("%w: %q for tenant %q", ErrScriptTypeNotAllowed, scriptType, tenantID)
	}

	if ctx.Err() != nil {
		return cancelledResult(ctx.Err()), nil
	}

	results := make([]cmdbmodels.ScriptExecTargetResult, 0, len(req.TargetCiIds))
	if r.parallel > 1 && len(req.TargetCiIds) > 1 {
		results = r.runParallel(ctx, tenantID, scriptType, body, req.TargetCiIds)
	} else {
		for _, ciID := range req.TargetCiIds {
			if ctx.Err() != nil {
				results = append(results, toTargetResult(cancelledTarget(ciID, ctx.Err())))
				continue
			}
			res, err := r.executeOne(ctx, tenantID, scriptType, body, ciID)
			if err != nil {
				res = ensureTargetResult(&ExecRequest{CIID: ciID}, nil)
				res.Error = err.Error()
			}
			results = append(results, toTargetResult(res))
		}
	}

	sort.SliceStable(results, func(i, j int) bool {
		// Preserve input order for CIID.
		ciIDi := indexOf(req.TargetCiIds, results[i].CIID)
		ciIDj := indexOf(req.TargetCiIds, results[j].CIID)
		return ciIDi < ciIDj
	})

	status := "completed"
	for _, rr := range results {
		if rr.Status != "success" {
			status = "failed"
			break
		}
	}
	return &cmdbmodels.ScriptExecResult{
		ExecutionID: newExecutionID(),
		Status:      status,
		Results:     results,
	}, nil
}

func (r *Router) executeOne(ctx context.Context, tenantID, scriptType, body, ciID string) (*ExecResult, error) {
	sshTarget, err := r.resolveSSH(ctx, tenantID, ciID)
	if err != nil {
		return ensureTargetResult(&ExecRequest{CIID: ciID}, nil), err
	}
	req := &ExecRequest{
		CIID:       ciID,
		Script:     body,
		ScriptType: scriptType,
		SSH:        sshTarget,
	}
	var exec Executor
	if sshTarget != nil {
		if r.ssh == nil {
			return ensureTargetResult(req, nil), ErrSSHNotConfigured
		}
		exec = r.ssh
	} else {
		r.mu.RLock()
		exec = r.executors[scriptType]
		r.mu.RUnlock()
		if exec == nil {
			return ensureTargetResult(req, nil), fmt.Errorf("%w: %q", ErrScriptTypeUnsupported, scriptType)
		}
		// Enforce router-level targetTimeout as a hard cap on any
		// Executor that might set its own shorter (or longer) internal
		// timeout. The Executor may still override with its own
		// shorter timeout; this is a maximum, not a minimum.
		exec = timeoutExecutor{inner: exec, timeout: r.targetTimeout}
	}
	res, err := exec.Execute(ctx, req)
	if err != nil {
		// Executor reported an error that should surface as target-level failure.
		return ensureTargetResult(req, nil), err
	}
	return ensureTargetResult(req, res), nil
}

func (r *Router) resolveSSH(ctx context.Context, tenantID, ciID string) (*SSHTarget, error) {
	if r.resolver == nil {
		return nil, nil
	}
	t, err := r.resolver.ResolveTarget(ctx, tenantID, ciID)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *Router) runParallel(ctx context.Context, tenantID, scriptType, body string, ciIDs []string) []cmdbmodels.ScriptExecTargetResult {
	results := make([]cmdbmodels.ScriptExecTargetResult, len(ciIDs))
	var wg sync.WaitGroup
	sem := make(chan struct{}, r.parallel)
	for i, ciID := range ciIDs {
		if ctx.Err() != nil {
			results[i] = toTargetResult(cancelledTarget(ciID, ctx.Err()))
			continue
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(i int, ciID string) {
			defer wg.Done()
			defer func() { <-sem }()
			res, err := r.executeOne(ctx, tenantID, scriptType, body, ciID)
			if err != nil {
				r2 := ensureTargetResult(&ExecRequest{CIID: ciID}, nil)
				r2.Error = err.Error()
				results[i] = toTargetResult(r2)
				return
			}
			results[i] = toTargetResult(res)
		}(i, ciID)
	}
	wg.Wait()
	return results
}

func cancelledResult(err error) *cmdbmodels.ScriptExecResult {
	return &cmdbmodels.ScriptExecResult{
		ExecutionID: newExecutionID(),
		Status:      "cancelled",
		Results:     []cmdbmodels.ScriptExecTargetResult{},
	}
}

// timeoutExecutor wraps an Executor and enforces a hard per-call
// deadline. If the inner Executor already has a shorter timeout, this
// wrapper is a no-op (inner finishes first). Otherwise it fires when
// the router's targetTimeout expires.
type timeoutExecutor struct {
	inner   Executor
	timeout time.Duration
}

func (t timeoutExecutor) Type() string { return t.inner.Type() }

func (t timeoutExecutor) Execute(ctx context.Context, req *ExecRequest) (*ExecResult, error) {
	if t.timeout <= 0 {
		return t.inner.Execute(ctx, req)
	}
	runCtx, cancel := context.WithTimeout(ctx, t.timeout)
	defer cancel()
	res, err := t.inner.Execute(runCtx, req)
	if runCtx.Err() == context.DeadlineExceeded && err == nil {
		return &ExecResult{
			CIID:   req.CIID,
			Status: "failed",
			Error:  fmt.Sprintf("script timed out after %v", t.timeout),
		}, nil
	}
	return res, err
}

func cancelledTarget(ciID string, err error) *ExecResult {
	return &ExecResult{
		CIID:   ciID,
		Status: "failed",
		Error:  err.Error(),
	}
}

func newExecutionID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return "exec-" + hex.EncodeToString(b)
}

func indexOf(items []string, v string) int {
	for i, s := range items {
		if s == v {
			return i
		}
	}
	return len(items)
}
