package engine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"time"

	"orion/pipeline-svc-go/internal/models"
	"orion/pipeline-svc-go/internal/repository"

	"go.uber.org/zap"
)

var (
	// ErrTaskTimeout is returned when a task exceeds its allowed execution time.
	ErrTaskTimeout = errors.New("task timed out")
	// ErrTaskConfig is returned when the task configuration is invalid.
	ErrTaskConfig = errors.New("invalid task configuration")
)

// taskScriptConfig represents a task configured with an inline script.
type taskScriptConfig struct {
	Script     string `json:"script"`
	Interpreter string `json:"interpreter"` // e.g. "bash", "sh", "python3"
	TimeoutSec int    `json:"timeout_seconds"`
}

// taskCommandConfig represents a task configured with a raw shell command.
type taskCommandConfig struct {
	Command     string `json:"command"`
	TimeoutSec  int    `json:"timeout_seconds"`
}

// RunTask executes a single task and returns its result.
// It inspects the task's Config (JSON) and type to determine how to run.
//
// Supported config formats:
//   - `{"command": "echo hello"}` — runs via `sh -c`
//   - `{"script": "echo hello", "interpreter": "bash"}` — runs via the named interpreter
//   - empty/unknown — falls back to `echo "task <name> completed"`
func RunTask(ctx context.Context, task *models.Task) (TaskResult, error) {
	result := TaskResult{Status: models.TaskFailed, ExitCode: 1}

	command, timeout, err := resolveTaskCommand(task)
	if err != nil {
		result.Error = err.Error()
		return result, err
	}

	// Apply timeout from config if no context deadline is set.
	execCtx := ctx
	if timeout > 0 {
		var cancel context.CancelFunc
		execCtx, cancel = context.WithTimeout(ctx, time.Duration(timeout)*time.Second)
		defer cancel()
	}

	cmd := exec.CommandContext(execCtx, "sh", "-c", command)
	cmd.Stdin = nil

	stdout, err := cmd.CombinedOutput()
	if err != nil {
		// Determine exit code.
		exitCode := 1
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			exitCode = exitErr.ExitCode()
		}
		// Context cancellation is treated as timeout.
		if errors.Is(execCtx.Err(), context.DeadlineExceeded) {
			result.Error = fmt.Sprintf("task timed out after %ds: %s", timeout, task.Name)
			result.ExitCode = 124 // Standard timeout exit code.
			return result, ErrTaskTimeout
		}
		result.Error = fmt.Sprintf("task '%s' failed (exit %d): %s", task.Name, exitCode, strings.TrimSpace(string(stdout)))
		result.ExitCode = exitCode
		return result, fmt.Errorf("%s: exit code %d", result.Error, exitCode)
	}

	result.Status = models.TaskSuccess
	result.Output = strings.TrimSpace(string(stdout))
	result.ExitCode = 0
	return result, nil
}

// resolveTaskCommand extracts the shell command and timeout from a task.
// It falls back to a default `echo` when no recognizable config is provided.
func resolveTaskCommand(task *models.Task) (command string, timeoutSec int, err error) {
	timeoutSec = 60 // Default 60s timeout.

	if task.Config == "" {
		return fmt.Sprintf("echo 'task %s completed'", task.Name), timeoutSec, nil
	}

	// Try script config first.
	var scriptCfg taskScriptConfig
	if err := json.Unmarshal([]byte(task.Config), &scriptCfg); err == nil && scriptCfg.Script != "" {
		interpreter := scriptCfg.Interpreter
		if interpreter == "" {
			interpreter = "sh"
		}
		if scriptCfg.TimeoutSec > 0 {
			timeoutSec = scriptCfg.TimeoutSec
		}
		return fmt.Sprintf("%s -c '%s'", interpreter, escapeForShell(scriptCfg.Script)), timeoutSec, nil
	}

	// Try command config.
	var cmdCfg taskCommandConfig
	if err := json.Unmarshal([]byte(task.Config), &cmdCfg); err == nil && cmdCfg.Command != "" {
		if cmdCfg.TimeoutSec > 0 {
			timeoutSec = cmdCfg.TimeoutSec
		}
		return cmdCfg.Command, timeoutSec, nil
	}

	// Unknown format — fall back to a safe default.
	return fmt.Sprintf("echo 'task %s: unknown config format, executing default'", task.Name), timeoutSec, nil
}

// escapeForShell escapes a string for safe inclusion in a single-quoted shell argument.
// Single quotes in shell cannot be escaped, so we close, add an escaped quote, and reopen.
func escapeForShell(s string) string {
	s = strings.ReplaceAll(s, `'`, `'\''`)
	return s
}

// TaskRunner provides methods to run, stop, and query the status of individual tasks.
// Phase 1: shell-based execution. Phase 2+ will support containerized execution.
type TaskRunner struct {
	logger *zap.Logger
}

// NewTaskRunner creates a new TaskRunner.
func NewTaskRunner(logger *zap.Logger) *TaskRunner {
	return &TaskRunner{logger: logger}
}

// Run executes a task and returns its result.
// It delegates to the package-level RunTask function.
func (r *TaskRunner) Run(ctx context.Context, task *models.Task) (TaskResult, error) {
	r.logger.Info("TaskRunner.Run", zap.String("task_id", task.ID), zap.String("task_name", task.Name))
	return RunTask(ctx, task)
}

// Stop is a no-op in Phase 1 (shell tasks cannot be forcibly stopped beyond context cancellation).
// Phase 2 will implement container kill logic.
func (r *TaskRunner) Stop(ctx context.Context, taskID string) error {
	r.logger.Info("TaskRunner.Stop (no-op in Phase 1)", zap.String("task_id", taskID))
	return nil
}

// Status returns the current task status by looking it up in the database.
// This requires a repository; the caller should pass the task repo.
func (r *TaskRunner) Status(ctx context.Context, taskID string, taskRepo *repository.TaskRepository) (models.TaskStatus, error) {
	task, err := taskRepo.GetByID(ctx, taskID)
	if err != nil {
		return models.TaskFailed, fmt.Errorf("task not found: %w", err)
	}
	return task.Status, nil
}
