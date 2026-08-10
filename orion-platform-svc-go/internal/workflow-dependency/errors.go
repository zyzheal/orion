package workflowdependency

import "errors"

type WorkflowDependencyError struct { Code string; Message string; Cause error }

func (e *WorkflowDependencyError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *WorkflowDependencyError) Is(target error) bool { _, ok := target.(*WorkflowDependencyError); return ok }
func (e *WorkflowDependencyError) Unwrap() error { return e.Cause }

var (
    ErrWorkflowDependencyNotFound     = &WorkflowDependencyError{Code: "workflowdependency_not_found", Message: "workflow-dependency: not found"}
    ErrWorkflowDependencyInvalidInput = &WorkflowDependencyError{Code: "workflowdependency_invalid_input", Message: "workflow-dependency: invalid input"}
    ErrWorkflowDependencyConflict     = &WorkflowDependencyError{Code: "workflowdependency_conflict", Message: "workflow-dependency: conflict"}
    ErrWorkflowDependencyUnauthorized = &WorkflowDependencyError{Code: "workflowdependency_unauthorized", Message: "workflow-dependency: unauthorized"}
    ErrWorkflowDependencyInternal     = &WorkflowDependencyError{Code: "workflowdependency_internal", Message: "workflow-dependency: internal error"}
)

func NewWorkflowDependencyError(code, msg string) error { return &WorkflowDependencyError{Code: code, Message: msg} }
func IsWorkflowDependencyNotFound(err error) bool { return errors.Is(err, ErrWorkflowDependencyNotFound) }
