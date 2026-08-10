package tracing

import "errors"

type TracingError struct { Code string; Message string; Cause error }

func (e *TracingError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *TracingError) Is(target error) bool { _, ok := target.(*TracingError); return ok }
func (e *TracingError) Unwrap() error { return e.Cause }

var (
    ErrTracingNotFound     = &TracingError{Code: "tracing_not_found", Message: "tracing: not found"}
    ErrTracingInvalidInput = &TracingError{Code: "tracing_invalid_input", Message: "tracing: invalid input"}
    ErrTracingConflict     = &TracingError{Code: "tracing_conflict", Message: "tracing: conflict"}
    ErrTracingUnauthorized = &TracingError{Code: "tracing_unauthorized", Message: "tracing: unauthorized"}
    ErrTracingInternal     = &TracingError{Code: "tracing_internal", Message: "tracing: internal error"}
)

func NewTracingError(code, msg string) error { return &TracingError{Code: code, Message: msg} }
func IsTracingNotFound(err error) bool { return errors.Is(err, ErrTracingNotFound) }
