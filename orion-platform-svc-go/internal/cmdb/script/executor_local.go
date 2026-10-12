package script

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// LocalExecutor runs scripts on the process host using /bin/sh, python,
// or terraform via the shell. It is intended for scripts explicitly
// whitelisted for the "cmdb" role (see Whitelist). NOT for arbitrary
// user-provided scripts without review.
//
// Safety model:
//   - Fixed binary path (never derived from ScriptType).
//   - Script body is passed via stdin; arguments are fixed. This
//     prevents shell injection through `bash --init-string`-style tricks.
//   - Hard timeout per request (MaxPerTargetTimeout).
//   - Output capped to avoid log flooding.
type LocalExecutor struct {
	// BashBin / PythonBin / TerraformBin override the default command
	// resolution. Settable for tests.
	BashBin      string
	PythonBin    string
	TerraformBin string
	// Timeout, if zero, uses MaxPerTargetTimeout.
	Timeout time.Duration
	// MaxOutputBytes caps how much output we retain.
	MaxOutputBytes int
}

// NewLocalExecutor returns a LocalExecutor with defaults.
func NewLocalExecutor() *LocalExecutor {
	return &LocalExecutor{
		BashBin:        "bash",
		PythonBin:      "python3",
		TerraformBin:   "terraform",
		Timeout:        MaxPerTargetTimeout * time.Millisecond,
		MaxOutputBytes: 64 * 1024,
	}
}

// Compile-time assert.
var _ Executor = (*LocalExecutor)(nil)

// Type returns the type this executor reports — but LocalExecutor
// dispatches on req.ScriptType, so this is only used for registration
// purposes. Router.Register calls each individual register* wrapper.
func (e *LocalExecutor) Type() string { return "bash" }

// Execute dispatches to bash/python/terraform based on req.ScriptType.
func (e *LocalExecutor) Execute(ctx context.Context, req *ExecRequest) (*ExecResult, error) {
	if req == nil || strings.TrimSpace(req.Script) == "" {
		return failResult(req, ErrScriptBodyEmpty), nil
	}
	if len(req.Script) > MaxScriptBytes {
		return failResult(req, ErrScriptTooLong), nil
	}
	if e.Timeout <= 0 {
		e.Timeout = MaxPerTargetTimeout * time.Millisecond
	}
	runCtx, cancel := context.WithTimeout(ctx, e.Timeout)
	defer cancel()

	bin, extraArgs, err := e.resolve(req.ScriptType)
	if err != nil {
		return failResult(req, err), nil
	}
	cmd := exec.CommandContext(runCtx, bin, extraArgs...) //nolint: gosec // bin is fixed whitelist
	cmd.Stdin = strings.NewReader(req.Script)
	var out, errBuf strings.Builder
	cmd.Stdout = &out
	cmd.Stderr = &errBuf

	runErr := cmd.Run()
	if runCtx.Err() == context.DeadlineExceeded {
		return failResult(req, fmt.Errorf("script timed out after %v", e.Timeout)), nil
	}
	if runErr != nil {
		res := failResult(req, runErr)
		res.Output = capOutput(e.MaxOutputBytes, out.String())
		if errBuf.Len() > 0 {
			res.Error = fmt.Sprintf("%v | stderr: %s", runErr.Error(), capOutput(e.MaxOutputBytes, errBuf.String()))
		}
		return res, nil
	}
	return &ExecResult{
		CIID:   req.CIID,
		Status: "success",
		Output: capOutput(e.MaxOutputBytes, out.String()),
	}, nil
}

func (e *LocalExecutor) resolve(scriptType string) (string, []string, error) {
	switch strings.ToLower(strings.TrimSpace(scriptType)) {
	case "", "bash", "sh":
		return e.BashBin, []string{}, nil
	case "python", "python3":
		return e.PythonBin, []string{}, nil
	case "python2":
		if e.PythonBin == "" {
			return "python2", []string{}, nil
		}
		return e.PythonBin, []string{}, nil
	case "terraform":
		return e.TerraformBin, []string{"apply", "-auto-approve", "-input=false"}, nil
	}
	return "", nil, ErrScriptTypeUnsupported
}

func failResult(req *ExecRequest, err error) *ExecResult {
	ciid := ""
	if req != nil {
		ciid = req.CIID
	}
	return &ExecResult{
		CIID:   ciid,
		Status: "failed",
		Error:  err.Error(),
	}
}

func capOutput(max int, s string) string {
	if max <= 0 || len(s) <= max {
		return s
	}
	return s[:max] + fmt.Sprintf("\n...[truncated %d bytes]", len(s)-max)
}
