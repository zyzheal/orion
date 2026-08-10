package workflowtrigger

import "errors"

type WorkflowTriggerError struct { Code string; Message string; Cause error }

func (e *WorkflowTriggerError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *WorkflowTriggerError) Is(target error) bool { _, ok := target.(*WorkflowTriggerError); return ok }
func (e *WorkflowTriggerError) Unwrap() error { return e.Cause }

var (
    ErrWorkflowTriggerNotFound     = &WorkflowTriggerError{Code: "workflowtrigger_not_found", Message: "workflow-trigger: not found"}
    ErrWorkflowTriggerInvalidInput = &WorkflowTriggerError{Code: "workflowtrigger_invalid_input", Message: "workflow-trigger: invalid input"}
    ErrWorkflowTriggerConflict     = &WorkflowTriggerError{Code: "workflowtrigger_conflict", Message: "workflow-trigger: conflict"}
    ErrWorkflowTriggerUnauthorized = &WorkflowTriggerError{Code: "workflowtrigger_unauthorized", Message: "workflow-trigger: unauthorized"}
    ErrWorkflowTriggerInternal     = &WorkflowTriggerError{Code: "workflowtrigger_internal", Message: "workflow-trigger: internal error"}
)

func NewWorkflowTriggerError(code, msg string) error { return &WorkflowTriggerError{Code: code, Message: msg} }
func IsWorkflowTriggerNotFound(err error) bool { return errors.Is(err, ErrWorkflowTriggerNotFound) }
