// Package service provides the PipelineExecutor — a chain-of-responsibility
// orchestrator that runs PipelineSteps in priority order.
//
// Inspired by NeatLogic's AlertEventManager pattern: each step is a pluggable
// handler that transforms input → output, and failures short-circuit the chain.
package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"orion/platform-svc-go/internal/pipeline-executor/models"
	"orion/platform-svc-go/internal/pipeline-executor/repository"

	"go.uber.org/zap"
)

// Sentinel errors.
var (
	ErrStepHandlerNotRegistered = errors.New("step handler not registered")
	ErrPipelineDisabled         = errors.New("pipeline is disabled")
	ErrNoSteps                  = errors.New("pipeline has no steps")
)

// StepHandler is the SPI that concrete step processors implement.
type StepHandler = models.StepHandler

// PipelineExecutor chains registered step handlers through a pipeline's steps
// in priority order, tracking each execution.
type PipelineExecutor struct {
	repo    *repository.Repository
	logger  *zap.Logger
	mu      sync.RWMutex
	steps   map[string]StepHandler // keyed by step type
}

// NewExecutor creates a PipelineExecutor backed by the given repository.
func NewExecutor(repo *repository.Repository, logger *zap.Logger) *PipelineExecutor {
	return &PipelineExecutor{
		repo:   repo,
		logger: logger,
		steps:  make(map[string]StepHandler),
	}
}

// RegisterStep registers a step handler by its type.
func (e *PipelineExecutor) RegisterStep(h StepHandler) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.steps[h.Type()] = h
	e.logger.Info("pipeline step handler registered",
		zap.String("type", h.Type()),
		zap.String("name", h.Name()),
	)
}

// ---------------------------------------------------------------------------
// Pipeline management
// ---------------------------------------------------------------------------

func (e *PipelineExecutor) CreatePipeline(ctx context.Context, tenantID, name, category string) (*models.Pipeline, error) {
	req := &models.CreatePipelineRequest{
		Name:     name,
		Category: category,
	}
	p, err := e.repo.CreatePipeline(ctx, tenantID, req)
	if err != nil {
		e.logger.Error("failed to create pipeline",
			zap.String("name", name),
			zap.Error(err),
		)
		return nil, err
	}
	e.logger.Info("pipeline created",
		zap.String("id", p.ID),
		zap.String("name", p.Name),
		zap.String("category", p.Category),
	)
	return p, nil
}

func (e *PipelineExecutor) GetPipeline(ctx context.Context, tenantID, pipelineID string) (*models.Pipeline, error) {
	return e.repo.GetPipeline(ctx, tenantID, pipelineID)
}

func (e *PipelineExecutor) ListPipelines(ctx context.Context, tenantID, status string, limit, offset int) (*models.PipelineListResponse, error) {
	return e.repo.ListPipelines(ctx, tenantID, status, limit, offset)
}

func (e *PipelineExecutor) UpdatePipeline(ctx context.Context, tenantID, pipelineID string, fields map[string]interface{}) (*models.Pipeline, error) {
	return e.repo.UpdatePipeline(ctx, tenantID, pipelineID, fields)
}

func (e *PipelineExecutor) DeletePipeline(ctx context.Context, tenantID, pipelineID string) error {
	return e.repo.DeletePipeline(ctx, tenantID, pipelineID)
}

// ---------------------------------------------------------------------------
// Step management
// ---------------------------------------------------------------------------

func (e *PipelineExecutor) AddStep(ctx context.Context, tenantID, pipelineID, name, stepType string, config map[string]string, priority int) (*models.PipelineStep, error) {
	req := &models.AddStepRequest{
		Name:     name,
		Type:     stepType,
		Config:   config,
		Priority: priority,
	}
	step, err := e.repo.CreateStep(ctx, tenantID, pipelineID, req)
	if err != nil {
		e.logger.Error("failed to add step",
			zap.String("pipelineId", pipelineID),
			zap.String("name", name),
			zap.Error(err),
		)
		return nil, err
	}
	e.logger.Info("step added",
		zap.String("stepId", step.ID),
		zap.String("pipelineId", pipelineID),
		zap.String("type", stepType),
		zap.Int("priority", priority),
	)
	return step, nil
}

func (e *PipelineExecutor) UpdateStep(ctx context.Context, tenantID, stepID string, fields map[string]interface{}) (*models.PipelineStep, error) {
	return e.repo.UpdateStep(ctx, tenantID, stepID, fields)
}

func (e *PipelineExecutor) DeleteStep(ctx context.Context, tenantID, stepID string) error {
	return e.repo.DeleteStep(ctx, tenantID, stepID)
}

func (e *PipelineExecutor) ListSteps(ctx context.Context, tenantID, pipelineID string, limit, offset int) (*models.StepListResponse, error) {
	return e.repo.ListSteps(ctx, tenantID, pipelineID, limit, offset)
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

// Execute loads a pipeline's steps in priority order, runs each registered
// step handler, passing the output of step N as the input to step N+1.
// Failures short-circuit the chain.
func (e *PipelineExecutor) Execute(ctx context.Context, tenantID, pipelineID string, input map[string]interface{}) (*models.PipelineExecution, error) {
	// Load pipeline and verify status
	pipeline, err := e.GetPipeline(ctx, tenantID, pipelineID)
	if err != nil {
		return nil, err
	}
	if pipeline.Status != models.PipelineStatusActive {
		e.logger.Warn("attempted to execute disabled pipeline",
			zap.String("id", pipelineID),
			zap.String("status", pipeline.Status),
		)
		return nil, fmt.Errorf("%w: %s", ErrPipelineDisabled, pipeline.Status)
	}

	// Load ordered steps
	steps, err := e.repo.StepsForPipeline(ctx, tenantID, pipelineID)
	if err != nil {
		return nil, err
	}
	if len(steps) == 0 {
		e.logger.Warn("pipeline has no enabled steps", zap.String("id", pipelineID))
		return nil, ErrNoSteps
	}

	// Serialise input
	inputJSON, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}

	// Create execution record
	startedAt := time.Now().UTC()
	exec := &models.PipelineExecution{
		ID:         "", // repository assigns UUID
		TenantID:   tenantID,
		PipelineID: pipelineID,
		Input:      string(inputJSON),
		Status:     models.ExecStatusRunning,
		StartedAt:  startedAt,
	}
	if err := e.repo.CreateExecution(ctx, exec); err != nil {
		return nil, err
	}

	e.logger.Info("pipeline execution started",
		zap.String("pipelineId", pipelineID),
		zap.String("execId", exec.ID),
	)

	var (
		currentInput = inputJSON
		stepsRun     int
		stepsFailed  int
		lastError    string
	)

	for _, step := range steps {
		handler, ok := e.getStepHandler(step.Type)
		if !ok {
			msg := fmt.Sprintf("no handler for step type: %s", step.Type)
			e.logger.Warn("unregistered step type, skipping",
				zap.String("stepId", step.ID),
				zap.String("type", step.Type),
			)
			stepsFailed++
			lastError = msg
			continue
		}

		// Parse step config
		config := make(map[string]string)
		if step.Config != "" && step.Config != "{}" {
			if err := json.Unmarshal([]byte(step.Config), &config); err != nil {
				msg := fmt.Sprintf("invalid config for step %s: %v", step.ID, err)
				e.logger.Warn("invalid step config", zap.String("stepId", step.ID), zap.Error(err))
				stepsFailed++
				lastError = msg
				continue
			}
		}

		// Process
		output, err := handler.Process(currentInput, config)
		if err != nil {
			msg := fmt.Sprintf("step %s (%s) failed: %v", step.ID, handler.Name(), err)
			e.logger.Error("pipeline step failed",
				zap.String("pipelineId", pipelineID),
				zap.String("stepId", step.ID),
				zap.String("handler", handler.Name()),
				zap.Error(err),
			)
			stepsFailed++
			lastError = msg
			// Short-circuit on failure
			break
		}

		stepsRun++
		currentInput = output

		e.logger.Info("pipeline step completed",
			zap.String("pipelineId", pipelineID),
			zap.String("stepId", step.ID),
			zap.String("handler", handler.Name()),
		)
	}

	// Finalise execution record
	finishedAt := time.Now().UTC()
	durationMs := finishedAt.Sub(startedAt).Milliseconds()
	status := models.ExecStatusCompleted
	if stepsFailed > 0 {
		status = models.ExecStatusFailed
	}

	exec.Status = status
	exec.Output = string(currentInput)
	exec.StepsRun = stepsRun
	exec.StepsFailed = stepsFailed
	exec.Error = lastError
	exec.FinishedAt = &finishedAt
	exec.DurationMs = durationMs

	if err := e.repo.FinishExecution(ctx, exec.ID, status, string(currentInput), lastError, durationMs, &finishedAt); err != nil {
		e.logger.Error("failed to persist execution result",
			zap.String("execId", exec.ID),
			zap.Error(err),
		)
	}

	e.logger.Info("pipeline execution finished",
		zap.String("execId", exec.ID),
		zap.String("pipelineId", pipelineID),
		zap.String("status", status),
		zap.Int("stepsRun", stepsRun),
		zap.Int("stepsFailed", stepsFailed),
		zap.Int64("durationMs", durationMs),
	)

	if status == models.ExecStatusFailed {
		return exec, fmt.Errorf("pipeline execution failed after %d/%d steps: %s", stepsRun, len(steps), lastError)
	}
	return exec, nil
}

// ---------------------------------------------------------------------------
// Execution history
// ---------------------------------------------------------------------------

func (e *PipelineExecutor) ListExecutions(ctx context.Context, tenantID, pipelineID string, limit, offset int) (*models.ExecutionListResponse, error) {
	return e.repo.ListExecutions(ctx, tenantID, pipelineID, limit, offset)
}

func (e *PipelineExecutor) getStepHandler(stepType string) (StepHandler, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	h, ok := e.steps[stepType]
	return h, ok
}
