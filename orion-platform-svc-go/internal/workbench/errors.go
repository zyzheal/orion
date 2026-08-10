package workbench

import "errors"

type WorkbenchError struct { Code string; Message string; Cause error }

func (e *WorkbenchError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *WorkbenchError) Is(target error) bool { _, ok := target.(*WorkbenchError); return ok }
func (e *WorkbenchError) Unwrap() error { return e.Cause }

var (
    ErrWorkbenchNotFound     = &WorkbenchError{Code: "workbench_not_found", Message: "workbench: not found"}
    ErrWorkbenchInvalidInput = &WorkbenchError{Code: "workbench_invalid_input", Message: "workbench: invalid input"}
    ErrWorkbenchConflict     = &WorkbenchError{Code: "workbench_conflict", Message: "workbench: conflict"}
    ErrWorkbenchUnauthorized = &WorkbenchError{Code: "workbench_unauthorized", Message: "workbench: unauthorized"}
    ErrWorkbenchInternal     = &WorkbenchError{Code: "workbench_internal", Message: "workbench: internal error"}
)

func NewWorkbenchError(code, msg string) error { return &WorkbenchError{Code: code, Message: msg} }
func IsWorkbenchNotFound(err error) bool { return errors.Is(err, ErrWorkbenchNotFound) }
