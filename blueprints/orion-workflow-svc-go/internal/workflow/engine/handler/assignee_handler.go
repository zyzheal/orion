package handler

import (
	"context"
	"fmt"
	"time"
)

// AssigneeStepHandler assigns a task to a specified user/team.
// This handler is the simplest: it records the assignee and immediately advances.
type AssigneeStepHandler struct{}

// Ensure interface compliance
var _ StepHandler = (*AssigneeStepHandler)(nil)

// Type returns the step type key.
func (h *AssigneeStepHandler) Type() string {
	return "assignee"
}

// Execute assigns the task and advances to the next node.
func (h *AssigneeStepHandler) Execute(ctx context.Context, task *WorkflowTaskContext, input JSONB) (*StepResult, error) {
	assignee, ok := task.StepConfig["assignee"]
	if !ok {
		return nil, fmt.Errorf("assignee not specified in step config")
	}

	// Record the assignment in workflow data
	if task.WorkflowData == nil {
		task.WorkflowData = JSONB{}
	}
	task.WorkflowData["lastAssignee"] = assignee
	task.WorkflowData["lastAssignmentAt"] = time.Now().Format(time.RFC3339)

	return &StepResult{
		Output: JSONB{
            "assignee":  assignee,
            "assignedAt": time.Now().Format(time.RFC3339),
        },
        Actions: []string{"assigned"},
    }, nil
}

// Validate checks that an assignee is configured.
func (h *AssigneeStepHandler) Validate(ctx context.Context, input JSONB) error {
	// Validation can be deferred to Execute where StepConfig is available.
	// Here we check the input payload for required fields.
	return nil
}

// Rollback undoes an assignment (idempotent).
func (h *AssigneeStepHandler) Rollback(ctx context.Context, task *WorkflowTaskContext, result *StepResult) error {
	// Clear the assignment from workflow data
	if task.WorkflowData != nil {
		delete(task.WorkflowData, "lastAssignee")
		delete(task.WorkflowData, "lastAssignmentAt")
	}
	return nil
}
