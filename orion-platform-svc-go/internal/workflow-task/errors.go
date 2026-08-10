package workflowtask

import "errors"

type WorkflowTaskError struct { Code string; Message string; Cause error }

func (e *WorkflowTaskError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *WorkflowTaskError) Is(target error) bool { _, ok := target.(*WorkflowTaskError); return ok }
func (e *WorkflowTaskError) Unwrap() error { return e.Cause }

var (
    ErrWorkflowTaskNotFound     = &WorkflowTaskError{Code: "workflowtask_not_found", Message: "workflow-task: not found"}
    ErrWorkflowTaskInvalidInput = &WorkflowTaskError{Code: "workflowtask_invalid_input", Message: "workflow-task: invalid input"}
    ErrWorkflowTaskConflict     = &WorkflowTaskError{Code: "workflowtask_conflict", Message: "workflow-task: conflict"}
    ErrWorkflowTaskUnauthorized = &WorkflowTaskError{Code: "workflowtask_unauthorized", Message: "workflow-task: unauthorized"}
    ErrWorkflowTaskInternal     = &WorkflowTaskError{Code: "workflowtask_internal", Message: "workflow-task: internal error"}
)

func NewWorkflowTaskError(code, msg string) error { return &WorkflowTaskError{Code: code, Message: msg} }
func IsWorkflowTaskNotFound(err error) bool { return errors.Is(err, ErrWorkflowTaskNotFound) }
