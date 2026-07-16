package engine

import (
	"context"
	"fmt"
	"time"

	"orion/ci-cd-svc-go/internal/pipeline/models"
	"orion/ci-cd-svc-go/internal/pipeline/repository"

	"go.uber.org/zap"
)

// OrchestratorDeps holds the dependencies for StageOrchestrator.
type OrchestratorDeps struct {
	StageRepo *repository.StageRepository
	TaskRepo  *repository.TaskRepository
	RunRepo   *repository.RunRepository
	Logger    *zap.Logger
}

// StageOrchestrator manages the lifecycle of pipeline stages.
// It implements the pending → running → completed state machine
// with sequential execution (Phase 1).
type StageOrchestrator struct {
	stageRepo *repository.StageRepository
	taskRepo  *repository.TaskRepository
	runRepo   *repository.RunRepository
	logger    *zap.Logger
}

// NewStageOrchestrator creates a new StageOrchestrator.
func NewStageOrchestrator(deps OrchestratorDeps) *StageOrchestrator {
	return &StageOrchestrator{
		stageRepo: deps.StageRepo,
		taskRepo:  deps.TaskRepo,
		runRepo:   deps.RunRepo,
		logger:    deps.Logger,
	}
}

// Execute runs all stages for a pipeline execution sequentially.
// It respects context cancellation and updates stage/run status
// in the database at each state transition.
func (o *StageOrchestrator) Execute(ctx context.Context, exec *Execution) error {
	runID := exec.Run.ID

	// Load all stages sorted by sequence.
	stages, err := o.stageRepo.GetByRunID(ctx, runID)
	if err != nil {
		return fmt.Errorf("orchestrator: failed to load stages: %w", err)
	}

	if len(stages) == 0 {
		o.logger.Info("no stages to execute", zap.String("run_id", runID))
		return nil
	}

	// Build executor for running tasks within stages.
	stageExecutor := NewStageExecutor(StageExecutorDeps{
		TaskRepo: o.taskRepo,
		Logger:   o.logger,
	})

	runFailed := false
	runStart := time.Now()

	for i := range stages {
		// Check for cancellation before starting each stage.
		if ctx.Err() != nil {
			o.logger.Info("execution cancelled before stage",
				zap.String("run_id", runID),
				zap.Int("remaining_stages", len(stages)-i),
			)
			runFailed = true
			break
		}

		stage := &stages[i]

		// Skip stages that are already completed (idempotent re-entry).
		if stage.Status == models.StageSuccess || stage.Status == models.StageSkipped {
			o.logger.Info("stage already completed, skipping",
				zap.String("run_id", runID),
				zap.String("stage_id", stage.ID),
				zap.String("stage_name", stage.Name),
				zap.String("status", string(stage.Status)),
			)
			continue
		}

		// Skip stages after a failure (failed stages are marked, downstream are skipped).
		if runFailed {
			if stage.Status != models.StageFailed && stage.Status != models.StageSkipped {
				_ = o.stageRepo.MarkCompleted(ctx, stage.ID, models.StageSkipped)
			}
			continue
		}

		// Execute the stage.
		if err := o.executeStage(ctx, exec, stage, stageExecutor); err != nil {
			o.logger.Error("stage failed",
				zap.String("run_id", runID),
				zap.String("stage_id", stage.ID),
				zap.String("stage_name", stage.Name),
				zap.Error(err),
			)
			runFailed = true
			continue
		}

		// Stage succeeded — verify completion was recorded.
		updatedStage, stageErr := o.stageRepo.GetByID(ctx, stage.ID)
		if stageErr == nil && updatedStage.Status != models.StageSuccess {
			o.logger.Warn("stage marked as running after executor completed, fixing",
				zap.String("stage_id", stage.ID),
				zap.String("actual_status", string(updatedStage.Status)),
			)
			_ = o.stageRepo.MarkCompleted(ctx, stage.ID, models.StageSuccess)
		}
	}

	// Finalize the run status.
	if err := o.finalizeRun(ctx, runID, runFailed, runStart); err != nil {
		o.logger.Error("failed to finalize run", zap.String("run_id", runID), zap.Error(err))
	}

	return nil
}

// executeStage runs a single stage through the StageExecutor.
func (o *StageOrchestrator) executeStage(
	ctx context.Context,
	exec *Execution,
	stage *models.Stage,
	executor *StageExecutor,
) error {
	runID := exec.Run.ID

	o.logger.Info("executing stage",
		zap.String("run_id", runID),
		zap.String("stage_id", stage.ID),
		zap.String("stage_name", stage.Name),
		zap.Int("sequence", stage.Sequence),
	)

	// Mark stage as running.
	if err := o.stageRepo.MarkRunning(ctx, stage.ID); err != nil {
		return fmt.Errorf("orchestrator: failed to mark stage running: %w", err)
	}

	// Load tasks for this stage.
	tasks, err := o.taskRepo.GetByStageID(ctx, stage.ID)
	if err != nil {
		_ = o.stageRepo.MarkCompleted(ctx, stage.ID, models.StageFailed)
		return fmt.Errorf("orchestrator: failed to load tasks for stage: %w", err)
	}

	if len(tasks) == 0 {
		// No tasks — stage trivially succeeds.
		o.logger.Info("stage has no tasks, marking as success",
			zap.String("stage_id", stage.ID),
		)
		if err := o.stageRepo.MarkCompleted(ctx, stage.ID, models.StageSuccess); err != nil {
			return fmt.Errorf("orchestrator: failed to mark stage completed: %w", err)
		}
		return nil
	}

	// Execute tasks within the stage.
	result, err := executor.ExecuteStage(ctx, runID, stage, tasks)
	if err != nil {
		_ = o.stageRepo.MarkCompleted(ctx, stage.ID, models.StageFailed)
		return fmt.Errorf("orchestrator: stage execution error: %w", err)
	}

	// Mark stage as completed based on task results.
	finalStatus := models.StageSuccess
	if !result.Success {
		finalStatus = models.StageFailed
	}

	stageLog := result.Output
	if result.Error != "" {
		if stageLog != "" {
			stageLog += "\n"
		}
		stageLog += "[ERROR] " + result.Error
	}
	if stageLog != "" {
		_ = o.stageRepo.AppendLog(ctx, stage.ID, stageLog)
	}

	if err := o.stageRepo.MarkCompleted(ctx, stage.ID, finalStatus); err != nil {
		return fmt.Errorf("orchestrator: failed to mark stage completed: %w", err)
	}

	if !result.Success {
		return fmt.Errorf("stage '%s' failed: %s", stage.Name, result.Error)
	}

	o.logger.Info("stage completed successfully",
		zap.String("run_id", runID),
		zap.String("stage_id", stage.ID),
		zap.String("stage_name", stage.Name),
	)

	return nil
}

// finalizeRun updates the run's terminal status based on stage outcomes.
func (o *StageOrchestrator) finalizeRun(ctx context.Context, runID string, hasFailure bool, startedAt time.Time) error {
	durationMs := time.Since(startedAt).Milliseconds()

	var status string
	if hasFailure {
		// Check if any stage explicitly failed (vs cancellation).
		stages, err := o.stageRepo.GetByRunID(ctx, runID)
		if err == nil {
			hasFailed := false
			for _, s := range stages {
				if s.Status == models.StageFailed {
					hasFailed = true
					break
				}
			}
			if !hasFailed {
				status = string(models.StatusCancelled)
			} else {
				status = string(models.StatusFailed)
			}
		} else {
			status = string(models.StatusFailed)
		}
	} else {
		status = string(models.StatusSuccess)
	}

	if err := o.runRepo.FinalizeRun(ctx, runID, status, durationMs); err != nil {
		return fmt.Errorf("orchestrator: failed to finalize run: %w", err)
	}

	o.logger.Info("run finalized",
		zap.String("run_id", runID),
		zap.String("status", status),
		zap.Int64("duration_ms", durationMs),
	)

	return nil
}
