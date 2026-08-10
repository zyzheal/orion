package runbook

import "errors"

type RunbookError struct { Code string; Message string; Cause error }

func (e *RunbookError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *RunbookError) Is(target error) bool { _, ok := target.(*RunbookError); return ok }
func (e *RunbookError) Unwrap() error { return e.Cause }

var (
    ErrRunbookNotFound     = &RunbookError{Code: "runbook_not_found", Message: "runbook: not found"}
    ErrRunbookInvalidInput = &RunbookError{Code: "runbook_invalid_input", Message: "runbook: invalid input"}
    ErrRunbookConflict     = &RunbookError{Code: "runbook_conflict", Message: "runbook: conflict"}
    ErrRunbookUnauthorized = &RunbookError{Code: "runbook_unauthorized", Message: "runbook: unauthorized"}
    ErrRunbookInternal     = &RunbookError{Code: "runbook_internal", Message: "runbook: internal error"}
)

func NewRunbookError(code, msg string) error { return &RunbookError{Code: code, Message: msg} }
func IsRunbookNotFound(err error) bool { return errors.Is(err, ErrRunbookNotFound) }
