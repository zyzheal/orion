// Package engine provides the AutoExecEngine — the NeatLogic-style automation
// orchestrator that dispatches tasks through the PluginSPI registry with
// retry, timeout, cancellation, and auditable history.
package engine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"go.uber.org/zap"

	"orion/platform-svc-go/internal/auto-exec/models"
	"orion/platform-svc-go/internal/auto-exec/repository"
)

// ---------------------------------------------------------------------------
// PluginHandler — the SPI that concrete plugins implement
// ---------------------------------------------------------------------------

var ErrPluginNotRegistered = errors.New("plugin not registered")
var ErrValidationFailed = errors.New("plugin validation failed")
var ErrTaskAlreadyRunning = errors.New("task is already running")

type PluginHandler interface {
	Name() string
	Category() string
	Execute(ctx context.Context, params map[string]string, task *models.ExecutionTask) (result string, err error)
	Validate(ctx context.Context, params map[string]string) error
}

// ---------------------------------------------------------------------------
// AutoExecEngine
// ---------------------------------------------------------------------------

type AutoExecEngine struct {
	repo    *repository.Repository
	plugins map[string]PluginHandler // registered by plugin name
	logger  *zap.Logger
}

func NewAutoExecEngine(repo *repository.Repository, logger *zap.Logger) *AutoExecEngine {
	return &AutoExecEngine{
		repo:    repo,
		plugins: make(map[string]PluginHandler),
		logger:  logger,
	}
}

// RegisterPlugin adds a plugin handler to the registry.
func (e *AutoExecEngine) RegisterPlugin(p PluginHandler) {
	e.plugins[p.Name()] = p
	e.logger.Info("plugin registered",
		zap.String("name", p.Name()),
		zap.String("category", p.Category()),
	)
}

// ListPlugins returns all registered plugins as PluginSPI descriptors.
func (e *AutoExecEngine) ListPlugins() []models.PluginSPI {
	var out []models.PluginSPI
	for name, p := range e.plugins {
		out = append(out, models.PluginSPI{
			Name:        name,
			Category:    p.Category(),
			Description: fmt.Sprintf("engine plugin: %s", name),
			Enabled:     true,
		})
	}
	return out
}

// ---------------------------------------------------------------------------
// CreateTask
// ---------------------------------------------------------------------------

// CreateTask persists a new execution task.
//
// The full request is forwarded, not just its name/plugin/params: silently
// dropping MaxRetries and Timeout would store a task the engine later runs
// with MaxRetries=0 and a 1-second timeout, because the repository clamps a
// zero timeout into [1, 3600] instead of treating it as "unset".
func (e *AutoExecEngine) CreateTask(ctx context.Context, tenantID string, req *models.CreateTaskRequest) (*models.ExecutionTask, error) {
	if req == nil {
		return nil, errors.New("create task request is nil")
	}
	// Validate plugin exists
	if _, ok := e.plugins[req.Plugin]; !ok {
		return nil, fmt.Errorf("plugin not registered: %s", req.Plugin)
	}

	if req.Type == "" {
		req.Type = "plugin"
	}
	task, err := e.repo.CreateTask(ctx, tenantID, req)
	if err != nil {
		// req, not task: the repository returns nil on error.
		e.logger.Error("failed to create task",
			zap.String("name", req.Name),
			zap.String("plugin", req.Plugin),
			zap.Error(err),
		)
		return nil, err
	}
	e.logger.Info("task created",
		zap.String("taskId", task.ID),
		zap.String("name", task.Name),
		zap.String("plugin", task.Plugin),
	)
	return task, nil
}

// ---------------------------------------------------------------------------
// ExecuteTask — run a task with retry, timeout, and history logging
// ---------------------------------------------------------------------------

// ExecuteTask runs a task with retry, timeout, and history logging.
//
// tenantID is passed by the caller (the handler, which reads it from the JWT
// middleware). It was once resolved from ctx.Value("tenant_id"), a key nothing
// in the platform ever sets, so every execution ran under tenant "system": the
// task lookup could only find tasks owned by "system" and an unauthenticated
// call would cross tenant boundaries.
func (e *AutoExecEngine) ExecuteTask(ctx context.Context, tenantID, taskID string, paramOverrides map[string]string) (*models.ExecutionTask, error) {
	// Load task
	task, err := e.repo.GetTask(ctx, tenantID, taskID)
	if err != nil {
		return nil, err
	}

	// Guard against double-execution
	if task.Status == models.StatusRunning {
		return nil, ErrTaskAlreadyRunning
	}

	plugin, ok := e.plugins[task.Plugin]
	if !ok {
		e.logger.Error("plugin not registered", zap.String("plugin", task.Plugin))
		task.Status = models.StatusFailed
		task.Error = fmt.Sprintf("plugin not registered: %s", task.Plugin)
		task.UpdatedAt = time.Now().UTC()
		if _, uerr := e.repo.UpdateTask(ctx, tenantID, taskID, map[string]interface{}{
			"status":     task.Status,
			"error":      task.Error,
			"updated_at": task.UpdatedAt,
		}); uerr != nil {
			e.logger.Error("failed to persist failure", zap.Error(uerr))
		}
		return task, ErrPluginNotRegistered
	}

	// Build runtime params. ParamOverrides carries the per-run overrides sent
	// in POST /tasks/:id/run; without the merge below the request body was read
	// and then discarded, so the advertised override had no effect.
	params := make(map[string]string)
	if task.PluginParams != "" {
		if jerr := json.Unmarshal([]byte(task.PluginParams), &params); jerr != nil {
			e.logger.Warn("invalid plugin_params JSON", zap.Error(jerr))
		}
	}
	if len(paramOverrides) > 0 {
		if params == nil {
			params = make(map[string]string)
		}
		for k, v := range paramOverrides {
			params[k] = v
		}
	}

	// Validate
	if verr := plugin.Validate(ctx, params); verr != nil {
		return nil, fmt.Errorf("%w: %v", ErrValidationFailed, verr)
	}

	// Timeout
	var cancel context.CancelFunc
	if task.Timeout > 0 {
		ctx, cancel = context.WithTimeout(ctx, time.Duration(task.Timeout)*time.Second)
		defer cancel()
	}

	// Mark running
	now := time.Now().UTC()
	task.Status = models.StatusRunning
	task.StartedAt = &now
	task.UpdatedAt = now
	if _, serr := e.repo.UpdateTask(ctx, tenantID, taskID, map[string]interface{}{
		"status":     task.Status,
		"started_at": task.StartedAt,
		"updated_at": task.UpdatedAt,
	}); serr != nil {
		e.logger.Error("failed to mark task running", zap.Error(serr))
	}

	// Execute with retries
	var lastResult string
	var lastErr error
	for attempt := 0; attempt <= task.MaxRetries; attempt++ {
		e.logger.Info("executing task attempt",
			zap.String("taskId", taskID),
			zap.String("plugin", task.Plugin),
			zap.Int("attempt", attempt+1),
		)
		result, err := plugin.Execute(ctx, params, task)
		if err == nil {
			task.Status = models.StatusCompleted
			task.Output = result
			lastResult = result
			break
		}
		lastErr = err
		lastResult = err.Error()
		e.logger.Warn("task attempt failed",
			zap.String("taskId", taskID),
			zap.Int("attempt", attempt+1),
			zap.Error(err),
		)
	}

	finishedAt := time.Now().UTC()
	task.FinishedAt = &finishedAt
	task.UpdatedAt = finishedAt

	if lastErr != nil {
		task.Status = models.StatusFailed
		task.Error = lastResult
		task.RetryCount = task.MaxRetries
	} else {
		task.RetryCount = 0
	}

	// Persist result
	if _, uerr := e.repo.UpdateTask(ctx, tenantID, taskID, map[string]interface{}{
		"status":      task.Status,
		"output":      task.Output,
		"error":       task.Error,
		"retry_count": task.RetryCount,
		"finished_at": task.FinishedAt,
		"updated_at":  task.UpdatedAt,
	}); uerr != nil {
		e.logger.Error("failed to persist task result", zap.Error(uerr))
	}

	// Write history entry
	durationMs := finishedAt.Sub(now).Milliseconds()
	statusMsg := task.Status
	if task.Output != "" {
		statusMsg = task.Output
	}
	if task.Error != "" {
		statusMsg = task.Error
	}
	if herr := e.repo.CreateHistory(ctx, &models.ExecutionHistory{
		TaskID:     taskID,
		Action:     task.Plugin,
		Result:     statusMsg,
		StartedAt:  now,
		FinishedAt: finishedAt,
		DurationMs: durationMs,
	}); herr != nil {
		e.logger.Error("failed to write history", zap.Error(herr))
	}

	e.logger.Info("task execution finished",
		zap.String("taskId", taskID),
		zap.String("status", task.Status),
		zap.Int64("durationMs", durationMs),
	)

	return task, nil
}
