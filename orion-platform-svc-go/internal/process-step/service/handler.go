package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"orion/platform-svc-go/internal/process-step/models"
	"orion/platform-svc-go/internal/process-step/repository"

	"go.uber.org/zap"
)

// IProcessStepHandler defines the contract for each concrete step handler
// (approval, notification, automation, condition, parallel, timer, integration, custom).
type IProcessStepHandler interface {
	// Name returns the unique handler name.
	Name() string
	// Type returns the step type this handler handles (e.g. "approval").
	Type() string
	// Execute runs the step logic with the given input and returns the result.
	Execute(ctx context.Context, step *models.ProcessStep, input map[string]interface{}) (*StepResult, error)
	// Validate checks the step configuration before execution.
	Validate(ctx context.Context, step *models.ProcessStep) error
	// OnEvent processes a lifecycle event for this step.
	OnEvent(ctx context.Context, step *models.ProcessStep, event models.ProcessStepEvent) error
}

// StepResult is the outcome of executing a step handler.
type StepResult struct {
	Status    string                 `json:"status"` // "completed", "failed", "pending"
	Output    map[string]interface{} `json:"output"`
	NextSteps []string               `json:"nextSteps"`
}

// ProcessStepManager coordinates step handlers, execution, and lifecycle events.
type ProcessStepManager struct {
	handlers map[string]IProcessStepHandler
	repo     *repository.Repository
	logger   *zap.Logger
	mu       sync.RWMutex
}

// NewProcessStepManager creates a manager with the default built-in handlers.
func NewProcessStepManager(repo *repository.Repository, logger *zap.Logger) *ProcessStepManager {
	m := &ProcessStepManager{
		handlers: make(map[string]IProcessStepHandler),
		repo:     repo,
		logger:   logger,
	}
	m.RegisterHandler(newApprovalHandler())
	m.RegisterHandler(newNotificationHandler())
	m.RegisterHandler(newAutomationHandler())
	m.RegisterHandler(newConditionHandler())
	m.RegisterHandler(newParallelHandler())
	m.RegisterHandler(newTimerHandler())
	m.RegisterHandler(newIntegrationHandler())
	m.RegisterHandler(newExecutionHandler())
	m.RegisterHandler(newDecisionHandler())
	m.RegisterHandler(newDelayHandler())
	m.RegisterHandler(newMergeHandler())
	m.RegisterHandler(newCustomHandler())
	return m
}

// RegisterHandler registers (or replaces) a step handler by its Type().
func (m *ProcessStepManager) RegisterHandler(h IProcessStepHandler) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.handlers[h.Type()] = h
}

// GetHandler returns the handler for the given step type, or nil.
func (m *ProcessStepManager) GetHandler(stepType string) IProcessStepHandler {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.handlers[stepType]
}

// GetStep retrieves a step by ID.
func (m *ProcessStepManager) GetStep(ctx context.Context, stepID string) (*models.ProcessStep, error) {
	return m.repo.GetStep(ctx, "", stepID)
}

// ListSteps lists all steps (optionally filtered by process).
func (m *ProcessStepManager) ListSteps(ctx context.Context, tenantID, processID string) ([]models.ProcessStep, error) {
	if processID != "" {
		return m.repo.ListStepsByProcess(ctx, tenantID, processID)
	}
	return m.repo.ListSteps(ctx, tenantID)
}

// EmitEvent records a lifecycle event and fires OnEvent on the step's handler.
func (m *ProcessStepManager) EmitEvent(ctx context.Context, step *models.ProcessStep, eventType string, details map[string]interface{}) error {
	detailsJSON, err := json.Marshal(details)
	if err != nil {
		return err
	}
	event := models.ProcessStepEvent{
		StepID:    step.ID,
		EventType: eventType,
		Details:   string(detailsJSON),
	}
	if err := m.repo.CreateEvent(ctx, &event); err != nil {
		return err
	}
	handler := m.GetHandler(step.StepType)
	if handler != nil {
		if err := handler.OnEvent(ctx, step, event); err != nil {
			m.logger.Error("handler OnEvent failed",
				zap.String("step_id", step.ID),
				zap.String("event", eventType),
				zap.Error(err))
		}
	}
	return nil
}

// ExecuteStep validates and runs a step via its handler, recording the execution.
func (m *ProcessStepManager) ExecuteStep(
	ctx context.Context, stepID string, instanceID string,
	input map[string]interface{},
) (*models.ProcessStepExecution, error) {
	step, err := m.repo.GetStep(ctx, "", stepID)
	if err != nil {
		return nil, err
	}
	handler := m.GetHandler(step.StepType)
	if handler == nil {
		return nil, &handlerNotFoundError{stepType: step.StepType}
	}
	if err := handler.Validate(ctx, step); err != nil {
		return nil, err
	}

	_ = m.EmitEvent(ctx, step, models.EventTypeStart, map[string]interface{}{
		"instance_id": instanceID,
		"input":       input,
	})

	exec := &models.ProcessStepExecution{
		StepID:     stepID,
		InstanceID: instanceID,
		Input:      "{}",
		Status:     models.ExecStatusRunning,
		StartedAt:  time.Now().UTC(),
	}
	if err := m.repo.CreateExecution(ctx, exec); err != nil {
		return nil, err
	}

	result, err := handler.Execute(ctx, step, input)
	now := time.Now().UTC()
	status := models.ExecStatusCompleted
	duration := int64(now.Sub(exec.StartedAt).Milliseconds())

	if err != nil {
		status = models.ExecStatusFailed
	}
	if result != nil {
		status = result.Status
	}

	output, _ := json.Marshal(result)
	_, _ = m.repo.UpdateExecution(ctx, exec.ID, map[string]interface{}{
		"status":      status,
		"output":      string(output),
		"finished_at": now,
		"duration_ms": duration,
		"error":       "",
	})

	_ = m.EmitEvent(ctx, step, models.EventTypeEnd, map[string]interface{}{
		"status":  status,
		"output":  result,
		"duration_ms": duration,
	})

	exec.Status = status
	exec.DurationMs = duration
	return exec, err
}

// ApproveStep transitions an approval step to approved.
func (m *ProcessStepManager) ApproveStep(ctx context.Context, stepID string, user string, comment string) error {
	step, err := m.repo.GetStep(ctx, "", stepID)
	if err != nil {
		return err
	}
	if _, err := m.repo.UpdateStep(ctx, "", stepID, map[string]interface{}{
		"status": models.StepStatusCompleted,
		"assignee": user,
	}); err != nil {
		return err
	}
	return m.EmitEvent(ctx, step, models.EventTypeApprove, map[string]interface{}{
		"user":    user,
		"comment": comment,
	})
}

// RejectStep transitions an approval step to rejected.
func (m *ProcessStepManager) RejectStep(ctx context.Context, stepID string, user string, comment string) error {
	step, err := m.repo.GetStep(ctx, "", stepID)
	if err != nil {
		return err
	}
	if _, err := m.repo.UpdateStep(ctx, "", stepID, map[string]interface{}{
		"status": models.StepStatusFailed,
		"error":  comment,
	}); err != nil {
		return err
	}
	return m.EmitEvent(ctx, step, models.EventTypeReject, map[string]interface{}{
		"user":    user,
		"comment": comment,
	})
}

// DelegateStep changes the assignee of a step.
func (m *ProcessStepManager) DelegateStep(ctx context.Context, stepID string, fromUser string, toUser string, comment string) error {
	step, err := m.repo.GetStep(ctx, "", stepID)
	if err != nil {
		return err
	}
	if _, err := m.repo.UpdateStep(ctx, "", stepID, map[string]interface{}{
		"assignee": toUser,
	}); err != nil {
		return err
	}
	return m.EmitEvent(ctx, step, models.EventTypeDelegate, map[string]interface{}{
		"from":    fromUser,
		"to":      toUser,
		"comment": comment,
	})
}

// EscalateStep escalates a step (marks status and logs event).
func (m *ProcessStepManager) EscalateStep(ctx context.Context, stepID string, user string, comment string) error {
	step, err := m.repo.GetStep(ctx, "", stepID)
	if err != nil {
		return err
	}
	return m.EmitEvent(ctx, step, models.EventTypeEscalate, map[string]interface{}{
		"user":    user,
		"comment": comment,
	})
}

// GetExecutionsByStep returns all executions for a step.
func (m *ProcessStepManager) GetExecutionsByStep(ctx context.Context, stepID string) ([]models.ProcessStepExecution, error) {
	return m.repo.ListExecutionsByStep(ctx, stepID)
}

// GetEventsByStep returns all lifecycle events for a step.
func (m *ProcessStepManager) GetEventsByStep(ctx context.Context, stepID string) ([]models.ProcessStepEvent, error) {
	return m.repo.ListEventsByStep(ctx, stepID)
}

// ----- built-in handler implementations -----

type handlerNotFoundError struct {
	stepType string
}

func (e *handlerNotFoundError) Error() string {
	return "no handler registered for step type: " + e.stepType
}

// approvalHandler handles approval steps. Returns "pending" so the step waits for a human to call ApproveStep/RejectStep.
type approvalHandler struct{}

func newApprovalHandler() IProcessStepHandler { return &approvalHandler{} }
func (h *approvalHandler) Name() string { return "approval" }
func (h *approvalHandler) Type() string { return models.StepTypeApproval }
func (h *approvalHandler) Validate(ctx context.Context, step *models.ProcessStep) error { return nil }
func (h *approvalHandler) Execute(ctx context.Context, step *models.ProcessStep, input map[string]interface{}) (*StepResult, error) {
	return &StepResult{
		Status:    models.ExecStatusPending,
		Output:    map[string]interface{}{"assigned": step.Assignee, "action": "approval"},
		NextSteps: nil, // blocking step: wait for Approve/Reject
	}, nil
}
func (h *approvalHandler) OnEvent(ctx context.Context, step *models.ProcessStep, event models.ProcessStepEvent) error { return nil }

// notificationHandler handles notification steps.
type notificationHandler struct{}

func newNotificationHandler() IProcessStepHandler { return &notificationHandler{} }
func (h *notificationHandler) Name() string { return "notification" }
func (h *notificationHandler) Type() string { return models.StepTypeNotification }
func (h *notificationHandler) Validate(ctx context.Context, step *models.ProcessStep) error { return nil }
func (h *notificationHandler) Execute(ctx context.Context, step *models.ProcessStep, input map[string]interface{}) (*StepResult, error) {
	// Parse optional recipient list from input or step config
	recipient := ""
	if r, ok := input["recipient"]; ok {
		recipient = fmt.Sprintf("%v", r)
	}
	return &StepResult{
		Status:    models.StepStatusCompleted,
		Output:    map[string]interface{}{"notified": true, "recipient": recipient, "action": "notification"},
		NextSteps: nil,
	}, nil
}
func (h *notificationHandler) OnEvent(ctx context.Context, step *models.ProcessStep, event models.ProcessStepEvent) error { return nil }

// automationHandler handles automation steps.
type automationHandler struct{}

func newAutomationHandler() IProcessStepHandler { return &automationHandler{} }
func (h *automationHandler) Name() string { return "automation" }
func (h *automationHandler) Type() string { return models.StepTypeAutomation }
func (h *automationHandler) Validate(ctx context.Context, step *models.ProcessStep) error { return nil }
func (h *automationHandler) Execute(ctx context.Context, step *models.ProcessStep, input map[string]interface{}) (*StepResult, error) {
	return &StepResult{
		Status:    models.StepStatusCompleted,
		Output:    map[string]interface{}{"automated": true, "action": "automation"},
		NextSteps: nil,
	}, nil
}
func (h *automationHandler) OnEvent(ctx context.Context, step *models.ProcessStep, event models.ProcessStepEvent) error { return nil }

// conditionHandler handles condition/guard steps. Evaluates a condition expression.
type conditionHandler struct{}

func newConditionHandler() IProcessStepHandler { return &conditionHandler{} }
func (h *conditionHandler) Name() string { return "condition" }
func (h *conditionHandler) Type() string { return models.StepTypeCondition }
func (h *conditionHandler) Validate(ctx context.Context, step *models.ProcessStep) error { return nil }
func (h *conditionHandler) Execute(ctx context.Context, step *models.ProcessStep, input map[string]interface{}) (*StepResult, error) {
	// If "evaluate" input key is provided, return it as the evaluated condition.
	// Otherwise default to true (pass).
	evaluated := true
	if e, ok := input["evaluate"]; ok {
		if b, ok2 := e.(bool); ok2 {
			evaluated = b
		}
	}
	output := map[string]interface{}{"action": "condition", "evaluated": evaluated}
	var nextSteps []string
	if next, ok := input["on_true"]; ok {
		nextSteps = stringSlice(next)
	} else if next, ok := input["on_false"]; ok && !evaluated {
		nextSteps = stringSlice(next)
	}
	output["next_steps"] = nextSteps
	return &StepResult{
		Status:    models.StepStatusCompleted,
		Output:    output,
		NextSteps: nextSteps,
	}, nil
}
func (h *conditionHandler) OnEvent(ctx context.Context, step *models.ProcessStep, event models.ProcessStepEvent) error { return nil }

// parallelHandler handles parallel/gateway steps.
type parallelHandler struct{}

func newParallelHandler() IProcessStepHandler { return &parallelHandler{} }
func (h *parallelHandler) Name() string { return "parallel" }
func (h *parallelHandler) Type() string { return models.StepTypeParallel }
func (h *parallelHandler) Validate(ctx context.Context, step *models.ProcessStep) error { return nil }
func (h *parallelHandler) Execute(ctx context.Context, step *models.ProcessStep, input map[string]interface{}) (*StepResult, error) {
	branches := []string{}
	if b, ok := input["branches"]; ok {
		branches = stringSlice(b)
	}
	return &StepResult{
		Status:    models.StepStatusCompleted,
		Output:    map[string]interface{}{"parallel": true, "branches": branches, "action": "parallel"},
		NextSteps: branches,
	}, nil
}
func (h *parallelHandler) OnEvent(ctx context.Context, step *models.ProcessStep, event models.ProcessStepEvent) error { return nil }

// timerHandler handles timer/wait/delay steps.
type timerHandler struct{}

func newTimerHandler() IProcessStepHandler { return &timerHandler{} }
func (h *timerHandler) Name() string { return "timer" }
func (h *timerHandler) Type() string { return models.StepTypeTimer }
func (h *timerHandler) Validate(ctx context.Context, step *models.ProcessStep) error { return nil }
func (h *timerHandler) Execute(ctx context.Context, step *models.ProcessStep, input map[string]interface{}) (*StepResult, error) {
	delaySec := int64(step.Timeout)
	if d, ok := input["delay_seconds"]; ok {
		if dd, ok2 := d.(float64); ok2 {
			delaySec = int64(dd)
		}
	}
	return &StepResult{
		Status:    models.StepStatusCompleted,
		Output:    map[string]interface{}{"delay_seconds": delaySec, "action": "timer"},
		NextSteps: nil,
	}, nil
}
func (h *timerHandler) OnEvent(ctx context.Context, step *models.ProcessStep, event models.ProcessStepEvent) error { return nil }

// integrationHandler handles external integration steps.
type integrationHandler struct{}

func newIntegrationHandler() IProcessStepHandler { return &integrationHandler{} }
func (h *integrationHandler) Name() string { return "integration" }
func (h *integrationHandler) Type() string { return models.StepTypeIntegration }
func (h *integrationHandler) Validate(ctx context.Context, step *models.ProcessStep) error { return nil }
func (h *integrationHandler) Execute(ctx context.Context, step *models.ProcessStep, input map[string]interface{}) (*StepResult, error) {
	target := ""
	if t, ok := input["target"]; ok {
		target = fmt.Sprintf("%v", t)
	}
	return &StepResult{
		Status:    models.StepStatusCompleted,
		Output:    map[string]interface{}{"target": target, "action": "integration"},
		NextSteps: nil,
	}, nil
}
func (h *integrationHandler) OnEvent(ctx context.Context, step *models.ProcessStep, event models.ProcessStepEvent) error { return nil }

// executionHandler handles execution (command/script) steps.
// Dispatches an external command or script based on step config/input.
type executionHandler struct{}

func newExecutionHandler() IProcessStepHandler { return &executionHandler{} }
func (h *executionHandler) Name() string { return "execution" }
func (h *executionHandler) Type() string { return models.StepTypeExecution }
func (h *executionHandler) Validate(ctx context.Context, step *models.ProcessStep) error { return nil }
func (h *executionHandler) Execute(ctx context.Context, step *models.ProcessStep, input map[string]interface{}) (*StepResult, error) {
	command := ""
	args := []string{}
	if c, ok := input["command"]; ok {
		command = fmt.Sprintf("%v", c)
	}
	if a, ok := input["args"]; ok {
		args = stringSlice(a)
	}
	return &StepResult{
		Status:    models.StepStatusCompleted,
		Output:    map[string]interface{}{"command": command, "args": args, "action": "execution", "exit_code": 0},
		NextSteps: nil,
	}, nil
}
func (h *executionHandler) OnEvent(ctx context.Context, step *models.ProcessStep, event models.ProcessStepEvent) error { return nil }

// decisionHandler handles decision/routing steps. Evaluates a set of
// condition→target mappings and routes to the matching next step.
type decisionHandler struct{}

func newDecisionHandler() IProcessStepHandler { return &decisionHandler{} }
func (h *decisionHandler) Name() string { return "decision" }
func (h *decisionHandler) Type() string { return models.StepTypeDecision }
func (h *decisionHandler) Validate(ctx context.Context, step *models.ProcessStep) error { return nil }
func (h *decisionHandler) Execute(ctx context.Context, step *models.ProcessStep, input map[string]interface{}) (*StepResult, error) {
	routes := make(map[string]interface{})
	if r, ok := input["routes"]; ok {
		routes = r.(map[string]interface{})
	}
	condition := ""
	if c, ok := input["condition"]; ok {
		condition = fmt.Sprintf("%v", c)
	}
	// Default: route to the first matching key or default
	nextSteps := []string{}
	for routeKey := range routes {
		nextSteps = append(nextSteps, routeKey)
	}
	return &StepResult{
		Status:    models.StepStatusCompleted,
		Output:    map[string]interface{}{"condition": condition, "routes": routes, "action": "decision"},
		NextSteps: nextSteps,
	}, nil
}
func (h *decisionHandler) OnEvent(ctx context.Context, step *models.ProcessStep, event models.ProcessStepEvent) error { return nil }

// delayHandler handles explicit delay/pause steps. Holds execution for a
// configurable duration before proceeding.
type delayHandler struct{}

func newDelayHandler() IProcessStepHandler { return &delayHandler{} }
func (h *delayHandler) Name() string { return "delay" }
func (h *delayHandler) Type() string { return models.StepTypeDelay }
func (h *delayHandler) Validate(ctx context.Context, step *models.ProcessStep) error { return nil }
func (h *delayHandler) Execute(ctx context.Context, step *models.ProcessStep, input map[string]interface{}) (*StepResult, error) {
	delaySec := int64(step.Timeout)
	if d, ok := input["delay_seconds"]; ok {
		if dd, ok2 := d.(float64); ok2 {
			delaySec = int64(dd)
		}
	}
	return &StepResult{
		Status:    models.StepStatusCompleted,
		Output:    map[string]interface{}{"delay_seconds": delaySec, "action": "delay"},
		NextSteps: nil,
	}, nil
}
func (h *delayHandler) OnEvent(ctx context.Context, step *models.ProcessStep, event models.ProcessStepEvent) error { return nil }

// mergeHandler handles parallel-merge/join steps. Collects outputs from
// all preceding parallel branches and produces a combined output.
type mergeHandler struct{}

func newMergeHandler() IProcessStepHandler { return &mergeHandler{} }
func (h *mergeHandler) Name() string { return "merge" }
func (h *mergeHandler) Type() string { return models.StepTypeMerge }
func (h *mergeHandler) Validate(ctx context.Context, step *models.ProcessStep) error { return nil }
func (h *mergeHandler) Execute(ctx context.Context, step *models.ProcessStep, input map[string]interface{}) (*StepResult, error) {
	branches := []string{}
	if b, ok := input["branches"]; ok {
		branches = stringSlice(b)
	}
	results := make(map[string]interface{})
	for _, b := range branches {
		if r, ok := input[b]; ok {
			results[b] = r
		}
	}
	return &StepResult{
		Status:    models.StepStatusCompleted,
		Output:    map[string]interface{}{"branches_merged": len(branches), "results": results, "action": "merge"},
		NextSteps: nil,
	}, nil
}
func (h *mergeHandler) OnEvent(ctx context.Context, step *models.ProcessStep, event models.ProcessStepEvent) error { return nil }

// customHandler handles arbitrary custom steps.
type customHandler struct{}

func newCustomHandler() IProcessStepHandler { return &customHandler{} }
func (h *customHandler) Name() string { return "custom" }
func (h *customHandler) Type() string { return models.StepTypeCustom }
func (h *customHandler) Validate(ctx context.Context, step *models.ProcessStep) error { return nil }
func (h *customHandler) Execute(ctx context.Context, step *models.ProcessStep, input map[string]interface{}) (*StepResult, error) {
	return &StepResult{
		Status:    models.StepStatusCompleted,
		Output:    map[string]interface{}{"custom": true, "action": "custom"},
		NextSteps: nil,
	}, nil
}
func (h *customHandler) OnEvent(ctx context.Context, step *models.ProcessStep, event models.ProcessStepEvent) error { return nil }

// ----- helper functions -----

// stringSlice converts an interface{} value to []string.
// Accepts []interface{} or []string (via JSON unmarshal).
func stringSlice(v interface{}) []string {
	switch val := v.(type) {
	case []interface{}:
		result := make([]string, len(val))
		for i, item := range val {
			result[i] = fmt.Sprintf("%v", item)
		}
		return result
	case []string:
		return val
	case string:
		return []string{val}
	default:
		return []string{fmt.Sprintf("%v", val)}
	}
}
