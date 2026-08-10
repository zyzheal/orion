package handler

import "errors"

type OrchestrationError struct { Code string; Message string; Cause error }

func (e *OrchestrationError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *OrchestrationError) Is(target error) bool { _, ok := target.(*OrchestrationError); return ok }
func (e *OrchestrationError) Unwrap() error { return e.Cause }

var (
    ErrOrchestrationNotFound     = &OrchestrationError{Code: "orchestration_not_found", Message: "orchestration: not found"}
    ErrOrchestrationInvalidInput = &OrchestrationError{Code: "orchestration_invalid_input", Message: "orchestration: invalid input"}
    ErrOrchestrationConflict     = &OrchestrationError{Code: "orchestration_conflict", Message: "orchestration: conflict"}
    ErrOrchestrationUnauthorized = &OrchestrationError{Code: "orchestration_unauthorized", Message: "orchestration: unauthorized"}
    ErrOrchestrationInternal     = &OrchestrationError{Code: "orchestration_internal", Message: "orchestration: internal error"}
)

func NewOrchestrationError(code, msg string) error { return &OrchestrationError{Code: code, Message: msg} }
func IsOrchestrationNotFound(err error) bool { return errors.Is(err, ErrOrchestrationNotFound) }
