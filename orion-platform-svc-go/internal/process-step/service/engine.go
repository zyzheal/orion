package service

import (
	"context"
	"fmt"
	"sort"
	"sync"

	"orion/platform-svc-go/internal/process-step/models"

	"go.uber.org/zap"
)

// ProcessInstance represents a single running instance of a process, tracking
// which steps have been executed, in-flight state, and accumulated workflow data.
type ProcessInstance struct {
	id            string                 `json:"id"`
	tenantID      string                 `json:"tenant_id"`
	processID     string                 `json:"process_id"`
	defID         string                 `json:"definition_id"` // process definition ID
	status        string                 `json:"status"`        // running, completed, failed, paused
	data          map[string]interface{} `json:"data"`          // aggregated state across steps
	stepsExecuted int                    `json:"steps_executed"`
	stepsFailed   int                    `json:"steps_failed"`
	mu            sync.RWMutex
}

// ID returns the instance identifier.
func (inst *ProcessInstance) ID() string {
	inst.mu.RLock()
	defer inst.mu.RUnlock()
	return inst.id
}

// NewProcessInstance creates a fresh process instance.
func NewProcessInstance(tenantID, processID, defID string) *ProcessInstance {
	return &ProcessInstance{
		id:            processID + "-" + defID,
		tenantID:      tenantID,
		processID:     processID,
		defID:         defID,
		status:        models.StepStatusReady,
		data:          make(map[string]interface{}),
		stepsExecuted: 0,
		stepsFailed:   0,
	}
}

// SetStatus updates the instance status with locking.
func (inst *ProcessInstance) SetStatus(status string) {
	inst.mu.Lock()
	defer inst.mu.Unlock()
	inst.status = status
}

// Status returns the instance status with locking.
func (inst *ProcessInstance) Status() string {
	inst.mu.RLock()
	defer inst.mu.RUnlock()
	return inst.status
}

// MergeOutput merges a handler's output into the instance data.
func (inst *ProcessInstance) MergeOutput(output map[string]interface{}) {
	inst.mu.Lock()
	defer inst.mu.Unlock()
	for k, v := range output {
		inst.data[k] = v
	}
}

// Data returns a copy of the instance data.
func (inst *ProcessInstance) Data() map[string]interface{} {
	inst.mu.RLock()
	defer inst.mu.RUnlock()
out := make(map[string]interface{}, len(inst.data))
for k, v := range inst.data {
out[k] = v
}
return out
}

// StepsExecuted returns the number of steps successfully executed.
func (inst *ProcessInstance) StepsExecuted() int {
	inst.mu.RLock()
	defer inst.mu.RUnlock()
	return inst.stepsExecuted
}

// StepsFailed returns the number of steps that failed.
func (inst *ProcessInstance) StepsFailed() int {
	inst.mu.RLock()
	defer inst.mu.RUnlock()
	return inst.stepsFailed
}

// ========== ProcessStepEngine ==========

// Engine orchestrates a full process (ordered sequence of steps).
// It resolves each step's handler, executes in order, and routes based on
// handler results (next steps, condition routing, parallel branches).
type Engine struct {
	manager *ProcessStepManager
	logger  *zap.Logger
	mu      sync.RWMutex

	// instances tracks running process instances
	instances map[string]*ProcessInstance
}

// EngineOptions configures the execution engine.
type EngineOptions struct {
	Logger  *zap.Logger
	Manager *ProcessStepManager
}

// NewEngine creates a process step execution engine.
func NewEngine(opts EngineOptions) *Engine {
	return &Engine{
		manager:   opts.Manager,
		logger:    opts.Logger,
		instances: make(map[string]*ProcessInstance),
	}
}

// GetHandler returns the handler for a step type (delegates to manager).
func (e *Engine) GetHandler(stepType string) IProcessStepHandler {
	if e.manager == nil {
		return nil
	}
	return e.manager.GetHandler(stepType)
}

// ListRegisteredHandlers returns all known step types.
func (e *Engine) ListRegisteredHandlers() []string {
	return []string{
		models.StepTypeApproval, models.StepTypeNotification, models.StepTypeAutomation,
		models.StepTypeCondition, models.StepTypeParallel, models.StepTypeTimer,
		models.StepTypeIntegration, models.StepTypeExecution, models.StepTypeDecision,
		models.StepTypeDelay, models.StepTypeMerge, models.StepTypeCustom,
	}
}

// RegisterHandler registers a handler (delegates to manager).
func (e *Engine) RegisterHandler(h IProcessStepHandler) {
	if e.manager == nil {
		return
	}
	e.manager.RegisterHandler(h)
}

// GetInstance returns a running process instance, or nil if not found.
func (e *Engine) GetInstance(instanceID string) *ProcessInstance {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.instances[instanceID]
}

// ListInstances returns all tracked instances.
func (e *Engine) ListInstances() []*ProcessInstance {
	e.mu.RLock()
	defer e.mu.RUnlock()
	insts := make([]*ProcessInstance, 0, len(e.instances))
	for _, inst := range e.instances {
		insts = append(insts, inst)
	}
	return insts
}

// ExecuteProcess runs a full process definition to completion (or until a blocking step).
//
// The process is defined by an ordered list of ProcessStep entries. The engine:
//   1. Sorts steps by Order
//   2. Iterates each step
//   3. Looks up and runs the matching handler
//   4. Merges output into the instance data
//   5. Routes to next step based on handler.NextSteps
//   6. Pauses on blocking steps (approval, pending)
func (e *Engine) ExecuteProcess(
	ctx context.Context,
	tenantID string,
	processID string,
	defID string,
	steps []models.ProcessStep,
	input map[string]interface{},
) (*ProcessInstance, error) {

	if len(steps) == 0 {
		return nil, fmt.Errorf("engine: no steps provided for process %s", processID)
	}

	instance := NewProcessInstance(tenantID, processID, defID)
	instance.data = make(map[string]interface{})
	if input != nil {
		for k, v := range input {
			instance.data[k] = v
		}
	}

	e.mu.Lock()
	e.instances[instance.id] = instance
	e.mu.Unlock()
	defer func() {
		e.mu.Lock()
		delete(e.instances, instance.id)
		e.mu.Unlock()
	}()

	instance.SetStatus(models.StepStatusRunning)
	e.log("process started", zap.String("instance_id", instance.id), zap.String("process_id", processID))

	// Sort steps by order
	sorted := make([]models.ProcessStep, len(steps))
	copy(sorted, steps)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Order < sorted[j].Order
	})

	// Resolve execution order. The "cursor" is the current step index.
	// For conditional/branching steps we support a flat sequential walk first,
	// then handler.NextSteps can redirect.
	for i, step := range sorted {
		select {
		case <-ctx.Done():
			instance.SetStatus(models.StepStatusFailed)
			e.log("process cancelled", zap.String("instance_id", instance.id), zap.String("step_id", step.ID))
			return instance, ctx.Err()
		default:
		}

		// Skip disabled steps
		if !step.Enabled {
			e.log("step skipped (disabled)", zap.String("step_id", step.ID), zap.String("name", step.Name))
			if e.manager != nil {
				_ = e.manager.EmitEvent(ctx, &step, models.EventTypeSkip, map[string]interface{}{
					"instance_id": instance.id,
					"reason":      "disabled",
				})
			}
			continue
		}

		// Run single step via handler directly (no DB required)
		result, err := e.runStep(ctx, instance, &step)
		if err != nil {
			instance.mu.Lock()
			instance.stepsFailed++
			instance.status = models.StepStatusFailed
			instance.mu.Unlock()
			e.log("process halted (step error)",
				zap.String("instance_id", instance.id),
				zap.String("step_id", step.ID),
				zap.Int("step_index", i),
				zap.Error(err),
			)
			return instance, fmt.Errorf("process halted at step %q (idx %d): %w", step.Name, i, err)
		}

		instance.mu.Lock()
		instance.stepsExecuted++
		instance.mu.Unlock()

		// Merge output into instance data
		if result != nil && result.Output != nil {
			instance.MergeOutput(result.Output)
		}

		// Emit end event
		if e.manager != nil {
			status := models.StepStatusCompleted
			if result != nil {
				status = result.Status
			}
			_ = e.manager.EmitEvent(ctx, &step, models.EventTypeEnd, map[string]interface{}{
				"instance_id": instance.id,
				"status":      status,
			})
		}

		// Check if step is blocking (e.g., approval waiting for human action)
		if result != nil && result.Status == models.ExecStatusPending {
			instance.SetStatus(models.StepStatusRunning)
			e.log("process paused (blocking step)",
				zap.String("instance_id", instance.id),
				zap.String("step_id", step.ID),
				zap.String("step_type", step.StepType),
			)
			return instance, nil // caller can resume later
		}

		// Handler returned a non-empty NextSteps: log routing
		if result != nil && len(result.NextSteps) > 0 {
			e.log("step routed to next",
				zap.String("step_id", step.ID),
				zap.Strings("next_steps", result.NextSteps),
			)
		}
	}

	instance.SetStatus(models.StepStatusCompleted)
	e.log("process completed",
		zap.String("instance_id", instance.id),
		zap.Int("steps_executed", instance.stepsExecuted),
		zap.Int("steps_failed", instance.stepsFailed),
	)
	return instance, nil
}

// runStep resolves and executes a single step through its handler.
func (e *Engine) runStep(ctx context.Context, inst *ProcessInstance, step *models.ProcessStep) (*StepResult, error) {
	if e.manager == nil {
		return nil, fmt.Errorf("engine: manager not configured")
	}

	handler := e.manager.GetHandler(step.StepType)
	if handler == nil {
		return nil, &handlerNotFoundError{stepType: step.StepType}
	}

	// Build step input: merge instance data
	inst.mu.RLock()
	stepInput := make(map[string]interface{})
	for k, v := range inst.data {
		stepInput[k] = v
	}
	inst.mu.RUnlock()

	if err := handler.Validate(ctx, step); err != nil {
		return nil, fmt.Errorf("validation failed for step %q (%s): %w", step.Name, step.StepType, err)
	}

	// Emit start event
	if e.manager != nil {
		_ = e.manager.EmitEvent(ctx, step, models.EventTypeStart, map[string]interface{}{
			"instance_id": inst.id,
		})
	}

	e.log("executing step",
		zap.String("step_id", step.ID),
		zap.String("step_type", step.StepType),
		zap.String("name", step.Name),
		zap.String("instance_id", inst.id),
	)

	result, err := handler.Execute(ctx, step, stepInput)
	if result == nil {
		result = &StepResult{
			Status:    models.StepStatusCompleted,
			Output:    map[string]interface{}{},
			NextSteps: nil,
		}
	}
	if err != nil {
		return result, err
	}
	return result, nil
}

// ResumeProcess resumes a paused process instance by re-running all steps.
// The caller is responsible for having resolved the blocking step (e.g., via
// ApproveStep) before calling this.
func (e *Engine) ResumeProcess(
	ctx context.Context,
	tenantID string,
	processID string,
	defID string,
	steps []models.ProcessStep,
	input map[string]interface{},
) (*ProcessInstance, error) {
	return e.ExecuteProcess(ctx, tenantID, processID, defID, steps, input)
}

// log is a safe wrapper around the logger that does nothing when nil.
func (e *Engine) log(msg string, fields ...zap.Field) {
	if e.logger != nil {
		e.logger.Info(msg, fields...)
	}
}
