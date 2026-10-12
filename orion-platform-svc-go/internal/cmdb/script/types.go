package script

import (
	"context"
	"errors"
	"fmt"
	"strings"

	cmdbmodels "orion/platform-svc-go/internal/cmdb/models"
)

// ExecRequest is the per-target invocation handed to an Executor.
// Kept internal (not cmdbmodels.ScriptExecRequest) so Executors do not
// need to know about the multi-target fan-out envelope.
type ExecRequest struct {
	CIID     string
	Script   string
	ScriptType string
	// SSH carries optional remote-execution coordinates. When Host is
	// empty, LocalExecutor is expected to run the script on the node
	// hosting the API process.
	SSH *SSHTarget
}

// SSHTarget is the resolved SSH target for a single CI.
type SSHTarget struct {
	Host     string
	Port     int
	User     string
	Password string // optional; Prefer KeyPath
	KeyPath  string // optional; prefer over Password if non-empty
}

// ExecResult is the per-target outcome.
type ExecResult struct {
	CIID   string
	Status string // "success" | "failed"
	Output string
	Error  string
}

// Executor is the pluggable SPI. New script types register by
// implementing this interface and passing themselves to Router.Register.
type Executor interface {
	// Execute runs the script for one target and returns a result.
	// Implementations MUST respect ctx cancellation and MUST NOT swallow
	// ctx.Err() as success.
	Execute(ctx context.Context, req *ExecRequest) (*ExecResult, error)
	// Type returns the canonical ScriptType key (e.g. "bash").
	Type() string
}

// toTargetResult adapts an internal ExecResult into the public
// cmdbmodels.ScriptExecTargetResult shape. Used by ExecuteForTarget.
func toTargetResult(r *ExecResult) cmdbmodels.ScriptExecTargetResult {
	return cmdbmodels.ScriptExecTargetResult{
		CIID:   r.CIID,
		Status: r.Status,
		Output: r.Output,
		Error:  r.Error,
	}
}

// Result is a convenience re-export for the router fan-out.
type Result = ExecResult

// ValidateScriptType performs whitelist-independent sanity checks on a
// ScriptType string. Router uses this before dispatch; callers can also
// call it directly to normalize "sh" → "bash".
func ValidateScriptType(t string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(t)) {
	case "", "sh":
		return "bash", nil
	case "bash":
		return "bash", nil
	case "python", "python3":
		return "python", nil
	case "python2":
		return "python2", nil
	case "terraform":
		return "terraform", nil
	default:
		return "", fmt.Errorf("%w: %q", ErrScriptTypeUnsupported, t)
	}
}

// isTerminalSuccess returns true only if ctx cancelled AND the executor
// already produced a result — used by tests to distinguish "cancelled
// mid-run" from "cancelled before start".
func isTerminalSuccess(res *ExecResult) bool {
	return res != nil && res.Status == "success"
}

// ensureTargetResult fills missing fields defensively.
func ensureTargetResult(req *ExecRequest, res *ExecResult) *ExecResult {
	if res == nil {
		res = &ExecResult{}
	}
	if res.CIID == "" {
		res.CIID = req.CIID
	}
	if res.Status == "" {
		res.Status = "failed"
	}
	if res.Error == "" && res.Status != "success" {
		res.Error = errors.New("executor returned no error and non-success status").Error()
	}
	return res
}
