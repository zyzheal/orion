package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"orion/pipeline-svc-go/internal/engine"
	"orion/pipeline-svc-go/internal/models"
	"orion/pipeline-svc-go/internal/repository"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var (
	ErrPipelineNotFound = errors.New("pipeline not found")
	ErrRunNotFound      = errors.New("pipeline run not found")
	ErrInvalidStatus    = errors.New("invalid status transition")
	ErrRunNotCancellable = errors.New("run is not in a cancellable state")

	tracer = otel.Tracer("orion-pipeline-svc")
)

type PipelineService struct {
	pipelineRepo *repository.PipelineRepository
	runRepo      *repository.RunRepository
	stageRepo    *repository.StageRepository
	taskRepo     *repository.TaskRepository
	engine       *engine.PipelineEngine
}

func NewPipelineService(
	pipelineRepo *repository.PipelineRepository,
	runRepo *repository.RunRepository,
	stageRepo *repository.StageRepository,
	taskRepo *repository.TaskRepository,
	engine *engine.PipelineEngine,
) *PipelineService {
	return &PipelineService{
		pipelineRepo: pipelineRepo,
		runRepo:      runRepo,
		stageRepo:    stageRepo,
		taskRepo:     taskRepo,
		engine:       engine,
	}
}

// ==================== Pipeline CRUD ====================

func (s *PipelineService) Create(ctx context.Context, p *models.Pipeline) error {
	ctx, span := tracer.Start(ctx, "PipelineService.Create",
		trace.WithAttributes(attribute.String("pipeline.name", p.Name)))
	defer span.End()

	if p.Status == "" {
		p.Status = "active"
	}
	if p.Version == "" {
		p.Version = "v1.0.0"
	}
	if err := s.pipelineRepo.Create(ctx, p); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return fmt.Errorf("failed to create pipeline: %w", err)
	}
	span.SetAttributes(attribute.String("pipeline.id", p.ID))
	return nil
}

func (s *PipelineService) GetByID(ctx context.Context, tenantID, id string) (*models.Pipeline, error) {
	ctx, span := tracer.Start(ctx, "PipelineService.GetByID",
		trace.WithAttributes(attribute.String("pipeline.id", id)))
	defer span.End()

	pipeline, err := s.pipelineRepo.GetByID(ctx, tenantID, id)
	if err != nil {
		span.RecordError(err)
		return nil, ErrPipelineNotFound
	}
	return pipeline, nil
}

func (s *PipelineService) List(ctx context.Context, tenantID string, offset, limit int) ([]models.Pipeline, error) {
	ctx, span := tracer.Start(ctx, "PipelineService.List",
		trace.WithAttributes(attribute.String("tenant.id", tenantID)))
	defer span.End()

	return s.pipelineRepo.List(ctx, tenantID, offset, limit)
}

func (s *PipelineService) Update(ctx context.Context, p *models.Pipeline) error {
	ctx, span := tracer.Start(ctx, "PipelineService.Update",
		trace.WithAttributes(attribute.String("pipeline.id", p.ID)))
	defer span.End()

	if err := s.pipelineRepo.Update(ctx, p); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return fmt.Errorf("failed to update pipeline: %w", err)
	}
	return nil
}

func (s *PipelineService) Delete(ctx context.Context, tenantID, id string) error {
	ctx, span := tracer.Start(ctx, "PipelineService.Delete",
		trace.WithAttributes(attribute.String("pipeline.id", id)))
	defer span.End()

	if err := s.pipelineRepo.Delete(ctx, tenantID, id); err != nil {
		span.RecordError(err)
		return fmt.Errorf("failed to delete pipeline: %w", err)
	}
	return nil
}

func (s *PipelineService) Count(ctx context.Context, tenantID string) (int, error) {
	return s.pipelineRepo.Count(ctx, tenantID)
}

// ==================== RunPipeline ====================

// RunPipeline starts a new execution of a pipeline.
// It validates the pipeline exists, creates a run record, parses stages from YAML config,
// and creates stage records with proper sequencing.
func (s *PipelineService) RunPipeline(ctx context.Context, tenantID, pipelineID string, req models.RunPipelineRequest) (*models.PipelineRun, error) {
	ctx, span := tracer.Start(ctx, "PipelineService.RunPipeline",
		trace.WithAttributes(
			attribute.String("pipeline.id", pipelineID),
			attribute.String("trigger.type", string(req.TriggerType)),
		))
	defer span.End()

	// Verify pipeline exists and belongs to tenant
	pipeline, err := s.pipelineRepo.GetByID(ctx, tenantID, pipelineID)
	if err != nil {
		span.RecordError(err)
		return nil, ErrPipelineNotFound
	}

	// Determine trigger type
	triggerType := req.TriggerType
	if triggerType == "" {
		triggerType = models.TriggerManual
	}

	// Serialize context map to JSON
	contextJSON := "{}"
	if req.Context != nil {
		if b, err := json.Marshal(req.Context); err == nil {
			contextJSON = string(b)
		}
	}

	// Create the run record
	run := &models.PipelineRun{
		PipelineID:      pipeline.ID,
		TenantID:        tenantID,
		PipelineVersion: pipeline.Version,
		TriggerType:     triggerType,
		Environment:     req.Environment,
		Status:          models.StatusPending,
		Context:         contextJSON,
	}
	if err := s.runRepo.Create(ctx, run); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, fmt.Errorf("failed to create pipeline run: %w", err)
	}
	span.SetAttributes(attribute.String("run.id", run.ID))

	// Mark run as running
	if err := s.runRepo.MarkStarted(ctx, run.ID); err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to mark run as started: %w", err)
	}
	run.Status = models.StatusRunning

	// Parse stages from YAML config and create stage records
	stageNames := parseStagesFromYAML(pipeline.YAMLConfig)
	for i, name := range stageNames {
		stage := &models.Stage{
			RunID:    run.ID,
			Name:     name,
			Sequence: i + 1,
			Status:   models.StagePending,
		}
		if err := s.stageRepo.Create(ctx, stage); err != nil {
			// Log but don't fail the run for stage creation errors
			span.AddEvent("stage_creation_failed", trace.WithAttributes(
				attribute.String("stage.name", name),
				attribute.String("error", err.Error()),
			))
		}
	}

	// Launch background execution via the engine (non-blocking).
	if s.engine != nil {
		go func() {
			if err := s.engine.Execute(ctx, tenantID, pipeline.ID, run.ID); err != nil {
				span.RecordError(err)
				span.SetStatus(codes.Error, "engine execution failed: "+err.Error())
			}
		}()
	}

	return run, nil
}

// ==================== TriggerRun (legacy) ====================

func (s *PipelineService) TriggerRun(ctx context.Context, tenantID, pipelineID, triggerType, triggerBy string) (*models.PipelineRun, error) {
	req := models.RunPipelineRequest{
		TriggerType: models.TriggerType(triggerType),
	}
	run, err := s.RunPipeline(ctx, tenantID, pipelineID, req)
	if err != nil {
		return nil, err
	}
	run.TriggerBy = triggerBy
	return run, nil
}

// ==================== GetRunStatus ====================

// GetRunStatus returns the current status of a pipeline run including stage details.
func (s *PipelineService) GetRunStatus(ctx context.Context, runID string) (*models.PipelineRun, error) {
	ctx, span := tracer.Start(ctx, "PipelineService.GetRunStatus",
		trace.WithAttributes(attribute.String("run.id", runID)))
	defer span.End()

	run, err := s.runRepo.GetByID(ctx, runID)
	if err != nil {
		span.RecordError(err)
		return nil, ErrRunNotFound
	}
	return run, nil
}

func (s *PipelineService) GetRunByID(ctx context.Context, id string) (*models.PipelineRun, error) {
	return s.GetRunStatus(ctx, id)
}

// ==================== CancelRun ====================

// CancelRun cancels a running pipeline run and marks all pending/running stages as failed.
func (s *PipelineService) CancelRun(ctx context.Context, runID string) (*models.PipelineRun, error) {
	ctx, span := tracer.Start(ctx, "PipelineService.CancelRun",
		trace.WithAttributes(attribute.String("run.id", runID)))
	defer span.End()

	// Verify run exists
	run, err := s.runRepo.GetByID(ctx, runID)
	if err != nil {
		span.RecordError(err)
		return nil, ErrRunNotFound
	}

	// Check if run is in a cancellable state
	if run.Status != models.StatusPending && run.Status != models.StatusRunning {
		span.SetStatus(codes.Error, "run not cancellable")
		return nil, ErrRunNotCancellable
	}

	// Cancel the run
	if err := s.runRepo.CancelRun(ctx, runID); err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to cancel run: %w", err)
	}

	// Mark all pending/running stages as failed
	stages, err := s.stageRepo.GetByRunID(ctx, runID)
	if err == nil {
		for _, stage := range stages {
			if stage.Status == models.StagePending || stage.Status == models.StageRunning {
				_ = s.stageRepo.MarkCompleted(ctx, stage.ID, models.StageFailed)
			}
		}
	}

	// Return updated run
	return s.runRepo.GetByID(ctx, runID)
}

// ==================== GetRunLogs ====================

// GetRunLogs retrieves execution logs for all stages in a pipeline run.
func (s *PipelineService) GetRunLogs(ctx context.Context, runID string) ([]models.RunLogEntry, error) {
	ctx, span := tracer.Start(ctx, "PipelineService.GetRunLogs",
		trace.WithAttributes(attribute.String("run.id", runID)))
	defer span.End()

	// Verify run exists
	if _, err := s.runRepo.GetByID(ctx, runID); err != nil {
		span.RecordError(err)
		return nil, ErrRunNotFound
	}

	logs, err := s.runRepo.GetRunLogs(ctx, runID)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to get run logs: %w", err)
	}
	return logs, nil
}

// ==================== ListRuns ====================

// ListRuns lists pipeline runs with optional filtering.
func (s *PipelineService) ListRuns(ctx context.Context, filter models.PipelineRunFilter) (*models.RunListResponse, error) {
	ctx, span := tracer.Start(ctx, "PipelineService.ListRuns",
		trace.WithAttributes(
			attribute.String("pipeline.id", filter.PipelineID),
			attribute.String("status", string(filter.Status)),
		))
	defer span.End()

	runs, total, err := s.runRepo.ListWithFilter(ctx, filter)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to list runs: %w", err)
	}

	return &models.RunListResponse{
		Data:  runs,
		Total: total,
	}, nil
}

func (s *PipelineService) ListRunsByPipeline(ctx context.Context, pipelineID string, offset, limit int) ([]models.PipelineRun, error) {
	return s.runRepo.ListByPipeline(ctx, pipelineID, offset, limit)
}

// ==================== GetPipelineStats ====================

// GetPipelineStats returns aggregate statistics for a pipeline.
func (s *PipelineService) GetPipelineStats(ctx context.Context, tenantID, pipelineID string) (*models.PipelineStats, error) {
	ctx, span := tracer.Start(ctx, "PipelineService.GetPipelineStats",
		trace.WithAttributes(attribute.String("pipeline.id", pipelineID)))
	defer span.End()

	// Verify pipeline exists
	if _, err := s.pipelineRepo.GetByID(ctx, tenantID, pipelineID); err != nil {
		span.RecordError(err)
		return nil, ErrPipelineNotFound
	}

	stats, err := s.pipelineRepo.GetStats(ctx, pipelineID)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to get pipeline stats: %w", err)
	}
	return stats, nil
}

// ==================== Stage Execution Tracking ====================

// GetStages returns all stages for a run.
func (s *PipelineService) GetStages(ctx context.Context, runID string) ([]models.Stage, error) {
	ctx, span := tracer.Start(ctx, "PipelineService.GetStages",
		trace.WithAttributes(attribute.String("run.id", runID)))
	defer span.End()

	return s.stageRepo.GetByRunID(ctx, runID)
}

// StartStage marks a stage as running.
func (s *PipelineService) StartStage(ctx context.Context, stageID string) error {
	ctx, span := tracer.Start(ctx, "PipelineService.StartStage",
		trace.WithAttributes(attribute.String("stage.id", stageID)))
	defer span.End()

	if err := s.stageRepo.MarkRunning(ctx, stageID); err != nil {
		span.RecordError(err)
		return fmt.Errorf("failed to start stage: %w", err)
	}
	return nil
}

// CompleteStage marks a stage as completed and checks if the run should be finalized.
func (s *PipelineService) CompleteStage(ctx context.Context, stageID string, status models.StageStatus) error {
	ctx, span := tracer.Start(ctx, "PipelineService.CompleteStage",
		trace.WithAttributes(
			attribute.String("stage.id", stageID),
			attribute.String("stage.status", string(status)),
		))
	defer span.End()

	if err := s.stageRepo.MarkCompleted(ctx, stageID, status); err != nil {
		span.RecordError(err)
		return fmt.Errorf("failed to complete stage: %w", err)
	}

	// Get the stage to find the run ID
	stage, err := s.stageRepo.GetByID(ctx, stageID)
	if err != nil {
		return nil // Stage updated, but can't check run completion
	}

	// Check if all stages are completed to finalize the run
	if err := s.checkAndUpdateRunCompletion(ctx, stage.RunID); err != nil {
		span.AddEvent("run_completion_check_failed", trace.WithAttributes(
			attribute.String("error", err.Error()),
		))
	}

	return nil
}

// AppendStageLog appends a log line to a stage.
func (s *PipelineService) AppendStageLog(ctx context.Context, stageID, logLine string) error {
	return s.stageRepo.AppendLog(ctx, stageID, logLine)
}

// ==================== Task Execution Tracking ====================

// GetTasksByStage returns all tasks for a stage.
func (s *PipelineService) GetTasksByStage(ctx context.Context, stageID string) ([]models.Task, error) {
	return s.taskRepo.GetByStageID(ctx, stageID)
}

// StartTask marks a task as running.
func (s *PipelineService) StartTask(ctx context.Context, taskID string) error {
	return s.taskRepo.MarkRunning(ctx, taskID)
}

// CompleteTask marks a task as completed.
func (s *PipelineService) CompleteTask(ctx context.Context, taskID string, status models.TaskStatus, exitCode int) error {
	return s.taskRepo.MarkCompleted(ctx, taskID, status, exitCode)
}

// AppendTaskLog appends a log line to a task.
func (s *PipelineService) AppendTaskLog(ctx context.Context, taskID, logLine string) error {
	return s.taskRepo.AppendLog(ctx, taskID, logLine)
}

// ==================== Internal Helpers ====================

// checkAndUpdateRunCompletion checks if all stages in a run are done and updates the run status accordingly.
func (s *PipelineService) checkAndUpdateRunCompletion(ctx context.Context, runID string) error {
	allDone, err := s.stageRepo.AllStagesCompleted(ctx, runID)
	if err != nil {
		return err
	}
	if !allDone {
		return nil // Still has pending/running stages
	}

	// Check if any stage failed
	hasFailed, err := s.stageRepo.HasFailedStages(ctx, runID)
	if err != nil {
		return err
	}

	if hasFailed {
		return s.runRepo.MarkCompleted(ctx, runID, string(models.StatusFailed))
	}
	return s.runRepo.MarkCompleted(ctx, runID, string(models.StatusSuccess))
}

// parseStagesFromYAML extracts stage names from a pipeline YAML config.
// Supports both structured YAML (with stages array) and defaults to standard stages.
func parseStagesFromYAML(yamlConfig string) []string {
	if yamlConfig == "" {
		return []string{"build", "test", "deploy"}
	}

	// Try to extract stage names from YAML
	// Look for patterns like "- name: xxx" under a stages section
	lines := strings.Split(yamlConfig, "\n")
	var stages []string
	inStages := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Detect "stages:" section
		if strings.HasPrefix(trimmed, "stages:") {
			inStages = true
			continue
		}

		if inStages {
			// Detect stage name entries: "- name: xxx" or "- xxx"
			if strings.HasPrefix(trimmed, "- name:") {
				name := strings.TrimSpace(strings.TrimPrefix(trimmed, "- name:"))
				name = strings.Trim(name, "\"'")
				if name != "" {
					stages = append(stages, name)
				}
			} else if strings.HasPrefix(trimmed, "- ") && !strings.Contains(trimmed, ":") {
				name := strings.TrimSpace(strings.TrimPrefix(trimmed, "- "))
				name = strings.Trim(name, "\"'")
				if name != "" {
					stages = append(stages, name)
				}
			} else if !strings.HasPrefix(trimmed, "-") && !strings.HasPrefix(trimmed, "#") && trimmed != "" {
				// End of stages section
				inStages = false
			}
		}
	}

	if len(stages) == 0 {
		return []string{"build", "test", "deploy"}
	}
	return stages
}
