package engine

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/ci-cd/pipeline/models"
	"orion/platform-svc-go/internal/ci-cd/pipeline/repository"

	"go.uber.org/zap"
)

// StageResult holds the aggregated outcome of executing all tasks in a stage.
type StageResult struct {
	Success bool
	Output  string
	Error   string
}

// StageExecutorDeps holds dependencies for StageExecutor.
type StageExecutorDeps struct {
	TaskRepo *repository.TaskRepository
	Logger   *zap.Logger
}

// StageExecutor runs tasks within a stage sequentially.
// It updates task states in the database and collects combined output.
type StageExecutor struct {
	taskRepo *repository.TaskRepository
	logger   *zap.Logger
}

// NewStageExecutor creates a new StageExecutor.
func NewStageExecutor(deps StageExecutorDeps) *StageExecutor {
	return &StageExecutor{
		taskRepo: deps.TaskRepo,
		logger:   deps.Logger,
	}
}

// ExecuteStage runs all pending tasks in a stage sequentially.
// It marks each task as running, executes it, and marks it as completed or failed.
// If any task fails, the stage stops immediately and returns the failure.
func (e *StageExecutor) ExecuteStage(
	ctx context.Context,
	runID string,
	stage *models.Stage,
	tasks []models.Task,
) (*StageResult, error) {
	result := &StageResult{Success: true}
	var outputBuilder strings.Builder

	// Apply per-task timeout.
	taskCtx, taskCancel := context.WithTimeout(ctx, 5*time.Minute)
	defer taskCancel()

	for i := range tasks {
		task := &tasks[i]

		// Skip tasks that are already completed (idempotent re-entry).
		if task.Status == models.TaskSuccess || task.Status == models.TaskFailed || task.Status == models.TaskSkipped {
			e.logger.Info("task already completed, skipping",
				zap.String("task_id", task.ID),
				zap.String("task_name", task.Name),
				zap.String("status", string(task.Status)),
			)
			continue
		}

		e.logger.Info("executing task",
			zap.String("run_id", runID),
			zap.String("stage_id", stage.ID),
			zap.String("task_id", task.ID),
			zap.String("task_name", task.Name),
			zap.Int("sequence", task.Sequence),
		)

		// Mark task as running.
		if err := e.taskRepo.MarkRunning(ctx, task.ID); err != nil {
			e.logger.Warn("failed to mark task running", zap.String("task_id", task.ID), zap.Error(err))
		}

		// Execute the task via the TaskRunner.
		taskResult, err := RunTask(taskCtx, task)

		// Build log entry.
		var logLine string
		if err != nil {
			logLine = fmt.Sprintf("[ERROR] task '%s' failed: %s", task.Name, err.Error())
			result.Error = err.Error()
			result.Success = false

			// Mark task as failed.
			_ = e.taskRepo.MarkCompleted(ctx, task.ID, models.TaskFailed, taskResult.ExitCode)
			_ = e.taskRepo.AppendLog(ctx, task.ID, logLine)
			outputBuilder.WriteString(logLine)
			outputBuilder.WriteString("\n")

			e.logger.Error("task failed",
				zap.String("task_id", task.ID),
				zap.String("task_name", task.Name),
				zap.Error(err),
				zap.Int("exit_code", taskResult.ExitCode),
			)
			return result, fmt.Errorf("task '%s' failed: %w", task.Name, err)
		}

		// Task succeeded.
		logLine = taskResult.Output
		exitCode := 0
		if taskResult.ExitCode != 0 {
			logLine = fmt.Sprintf("[WARN] task '%s' exited with code %d\n%s", task.Name, taskResult.ExitCode, taskResult.Output)
			exitCode = taskResult.ExitCode
		}

		if logLine != "" {
			_ = e.taskRepo.AppendLog(ctx, task.ID, logLine)
			outputBuilder.WriteString(logLine)
			outputBuilder.WriteString("\n")
		}

		if err := e.taskRepo.MarkCompleted(ctx, task.ID, models.TaskSuccess, exitCode); err != nil {
			e.logger.Warn("failed to mark task completed", zap.String("task_id", task.ID), zap.Error(err))
		}

		e.logger.Info("task completed",
			zap.String("task_id", task.ID),
			zap.String("task_name", task.Name),
			zap.Int("exit_code", exitCode),
		)
	}

	result.Output = outputBuilder.String()
	return result, nil
}
