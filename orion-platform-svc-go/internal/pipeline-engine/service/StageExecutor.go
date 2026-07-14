package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/pipeline-engine/models"
	"orion/platform-svc-go/internal/pipeline-engine/repository"
)

// StageExecutor executes tasks within a stage.
type StageExecutor struct {
	repo    *repository.Repository
	timeout time.Duration
}

// NewStageExecutor creates a new StageExecutor.
func NewStageExecutor(repo *repository.Repository) *StageExecutor {
	return &StageExecutor{
		repo:    repo,
		timeout: 3600 * time.Second, // default 1h
	}
}

// SetTimeout sets the task execution timeout.
func (s *StageExecutor) SetTimeout(d time.Duration) {
	if d > 0 {
		s.timeout = d
	}
}

// ExecuteResult is the result of a task execution.
type ExecuteResult struct {
	Success bool
	Error   string
	Outputs map[string]string
}

// ExecuteTask executes a single task within a stage.
// It runs the task, records timing, and updates status.
//
// For v1, this is a placeholder that records task state changes.
// In production, this would invoke a container executor, shell runner, or
// plugin-based task runner.
func (s *StageExecutor) ExecuteTask(
	ctx context.Context,
	tenantID, stageID string,
	task *models.Task,
	variables map[string]string,
) (string, *ExecuteResult) {
	_ = variables // unused in v1 placeholder
	// Update task to RUNNING
	runningTask := *task
	runningTask.Status = models.TaskStatusRunning
	runningTask.StartedAt = nowUnix()
	runningTask.UpdatedAt = *runningTask.StartedAt
	if err := s.repo.UpdateTaskStatus(ctx, tenantID, runningTask.ID, models.TaskStatusRunning, runningTask.StartedAt, nil, nil, nil); err != nil {
		return task.Name, &ExecuteResult{
			Success: false,
			Error:   fmt.Sprintf("failed to mark task as running: %v", err),
		}
	}

	// Check for context cancellation (simulated task execution)
	select {
	case <-ctx.Done():
		failedTask := runningTask
		failedTask.Status = models.TaskStatusFailed
		failedTask.CompletedAt = nowUnixPtr()
		failedTask.DurationMs = durationMs(failedTask.StartedAt)
		failedTask.UpdatedAt = *failedTask.CompletedAt
		cancelMsg := "context cancelled"
		_ = s.repo.UpdateTaskStatus(ctx, tenantID, failedTask.ID, models.TaskStatusFailed, failedTask.CompletedAt, failedTask.DurationMs, &cancelMsg, nil)
		return task.Name, &ExecuteResult{
			Success: false,
			Error:   "context cancelled",
		}
	default:
	}

	// --- Placeholder task execution ---
	// In production, this would dispatch to a task runner:
	//   - For "shell" type: execute command via exec.Command
	//   - For "docker" type: run container via K8s/Docker
	//   - For "sub-pipeline" type: invoke child pipeline
	//
	// For now, simulate a brief task execution with variable injection.

	// Resolve variables in task parameters
	_ = task.Parameters // unused in v1 placeholder

	// Simulate task execution delay (minimal)
	// Production would actually run the task here
	time.Sleep(10 * time.Millisecond)

	// Mark task as SUCCESS
	completedTask := runningTask
	completedTask.Status = models.TaskStatusSuccess
	completedTask.CompletedAt = nowUnixPtr()
	completedTask.DurationMs = durationMs(completedTask.StartedAt)
	completedTask.UpdatedAt = *completedTask.CompletedAt
	_ = s.repo.UpdateTaskStatus(ctx, tenantID, completedTask.ID, models.TaskStatusSuccess, completedTask.CompletedAt, completedTask.DurationMs, nil, nil)

	return task.Name, &ExecuteResult{
		Success: true,
		Outputs: make(map[string]string),
	}
}

// PassUpstreamArtifacts transfers artifacts from upstream stages to a target stage.
func (s *StageExecutor) PassUpstreamArtifacts(
	ctx context.Context,
	tenantID, runID string,
	upstreamStageNames []string,
	targetStageID string,
) error {
	// For v1, artifact passing is a no-op.
	// In production, this would transfer build artifacts (files, logs, etc.)
	// from upstream stage workspaces to the target stage.
	//
	// Artifact sources:
	//   - Build cache (CacheRestoreSaveService)
	//   - Docker images (ArtifactService)
	//   - Test reports (TestReportService)
	//   - Package files (ApkMarketUploadService)
	//
	// Artifact destination:
	//   - Target stage workspace
	//   - Environment variables (${artifact:<path>})
	_ = ctx
	_ = tenantID
	_ = runID
	_ = upstreamStageNames
	_ = targetStageID
	return nil
}

// --- helpers ---

func nowUnix() *int64 {
	t := time.Now().Unix()
	return &t
}

func nowUnixPtr() *int64 {
	return nowUnix()
}

func durationMs(started *int64) *int64 {
	if started == nil {
		return nil
	}
	d := time.Since(time.Unix(*started, 0)).Milliseconds()
	return &d
}

// serializeParams serializes a map to JSONB-compatible string.
func serializeParams(params map[string]interface{}) (string, error) {
	if params == nil {
		return "{}", nil
	}
	b, err := json.Marshal(params)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
