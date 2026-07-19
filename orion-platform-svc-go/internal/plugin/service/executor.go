package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"sync"
	"time"

	"orion/go-common/pkg/plugin"
	"orion/platform-svc-go/internal/plugin/models"
)

// =============================================================================
// Executor — drives the actual execution of a plugin
// =============================================================================

// Executor defines the contract for running a plugin.
type Executor interface {
	// Execute runs the plugin identified by the given Plugin record and
	// execution input.  It returns a populated ExecutionResult that the
	// caller should persist via Service.CompleteExecution.
	Execute(ctx context.Context, p *models.Plugin, req *models.ExecutePluginRequest) (*models.ExecutionResult, error)

	// Kill terminates a running execution identified by taskID.
	Kill(taskID string, reason string) error

	// GetActiveCount returns the number of in-flight executions.
	GetActiveCount() int
}

// =============================================================================
// SubprocessExecutor
// =============================================================================

// SubprocessExecutor runs plugins as external child processes.  Input is
// passed via stdin as JSON; the plugin is expected to write its result to
// stdout as a single JSON line.
type SubprocessExecutor struct {
	mu       sync.Mutex
	running  map[string]*runningProcess
	timeout  time.Duration
}

type runningProcess struct {
	cmd     *exec.Cmd
	cancel  context.CancelFunc
	started time.Time
}

// NewSubprocessExecutor creates an executor with the given default timeout.
func NewSubprocessExecutor(defaultTimeout time.Duration) *SubprocessExecutor {
	if defaultTimeout <= 0 {
		defaultTimeout = 5 * time.Minute
	}
	return &SubprocessExecutor{
		running: make(map[string]*runningProcess),
		timeout: defaultTimeout,
	}
}

// Execute runs the plugin binary as a subprocess.
//
// Input is serialised to JSON and piped to the process's stdin.  The plugin
// must write a single JSON object to stdout that can be unmarshalled into
// plugin.ExecuteResult.  Stderr is captured for diagnostics.
func (e *SubprocessExecutor) Execute(ctx context.Context, p *models.Plugin, req *models.ExecutePluginRequest) (*models.ExecutionResult, error) {
	if p == nil {
		return nil, plugin.ErrPluginNotFound
	}
	if !p.Enabled {
		return nil, plugin.ErrPluginDisabled
	}

	entrypoint := p.Entrypoint
	if entrypoint == "" {
		return nil, fmt.Errorf("plugin %q has no entrypoint", p.ID)
	}

	// Build the input payload.
	inputPayload := map[string]interface{}{
		"task_id":        req.TaskID,
		"pipeline_run_id": req.PipelineRunID,
		"stage_id":       req.StageID,
		"input":          req.Input,
		"config":         p.Config,
	}

	inputJSON, err := json.Marshal(inputPayload)
	if err != nil {
		return nil, fmt.Errorf("marshal input: %w", err)
	}

	// Determine timeout from plugin config or default.
	timeout := e.timeout
	if p.Config != nil {
		if v, ok := p.Config["timeout_ms"]; ok {
			if ms, ok := toInt(v); ok && ms > 0 {
				timeout = time.Duration(ms) * time.Millisecond
			}
		}
	}

	execCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	cmd := exec.CommandContext(execCtx, entrypoint)
	cmd.Stdin = bytes.NewReader(inputJSON)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// Register the running process.
	taskID := req.TaskID
	e.mu.Lock()
	e.running[taskID] = &runningProcess{
		cmd:     cmd,
		cancel:  cancel,
		started: time.Now(),
	}
	e.mu.Unlock()

	start := time.Now()
	err = cmd.Run()
	durationMs := int(time.Since(start).Milliseconds())

	// Unregister.
	e.mu.Lock()
	delete(e.running, taskID)
	e.mu.Unlock()

	result := &models.ExecutionResult{
		TaskID:       req.TaskID,
		DurationMs:   durationMs,
		Stdout:       stdout.String(),
		Stderr:       stderr.String(),
	}

	if err != nil {
		// Distinguish timeout/kill from regular failure.
		if execCtx.Err() != nil {
			if errors.Is(execCtx.Err(), context.DeadlineExceeded) {
				result.Success = false
				result.ExitCode = -1
				result.ErrorMessage = fmt.Sprintf("execution timed out after %v", timeout)
				result.Killed = true
				result.KillReason = "timeout"
				return result, nil
			}
			// Killed externally.
			result.Success = false
			result.ExitCode = -1
			result.ErrorMessage = "execution was killed"
			result.Killed = true
			result.KillReason = "killed"
			return result, nil
		}

		// Non-zero exit.
		if exitErr, ok := err.(*exec.ExitError); ok {
			result.Success = false
			result.ExitCode = exitErr.ExitCode()
			result.ErrorMessage = fmt.Sprintf("plugin exited with code %d: %s",
				exitErr.ExitCode(), strings.TrimSpace(stderr.String()))
			return result, nil
		}

		result.Success = false
		result.ExitCode = -1
		result.ErrorMessage = fmt.Sprintf("plugin execution failed: %s", err.Error())
		return result, nil
	}

	// Success — try to parse stdout as ExecuteResult.
	result.Success = true
	result.ExitCode = 0

	// If the plugin wrote structured JSON to stdout, extract Output.
	if stdout.Len() > 0 {
		var execResult plugin.ExecuteResult
		if json.Unmarshal(stdout.Bytes(), &execResult) == nil {
			result.Output = execResult.Output
		}
	}

	return result, nil
}

// Kill terminates a running process by task ID.
func (e *SubprocessExecutor) Kill(taskID string, reason string) error {
	e.mu.Lock()
	rp, ok := e.running[taskID]
	e.mu.Unlock()

	if !ok {
		return fmt.Errorf("no running execution for task %q", taskID)
	}

	rp.cancel()
	if rp.cmd != nil && rp.cmd.Process != nil {
		_ = rp.cmd.Process.Kill()
	}

	return nil
}

// GetActiveCount returns the number of currently executing plugins.
func (e *SubprocessExecutor) GetActiveCount() int {
	e.mu.Lock()
	defer e.mu.Unlock()
	return len(e.running)
}

// =============================================================================
// helpers
// =============================================================================

func toInt(v interface{}) (int, bool) {
	switch val := v.(type) {
	case float64:
		return int(val), true
	case int:
		return val, true
	case int64:
		return int(val), true
	case json.Number:
		n, err := val.Int64()
		if err != nil {
			return 0, false
		}
		return int(n), true
	default:
		return 0, false
	}
}

// Ensure SubprocessExecutor is a valid Executor.
var _ Executor = (*SubprocessExecutor)(nil)

// init check — compile-time assertion that the SPI types are importable.
var _ = (*plugin.PluginConfig)(nil)