package observability

import "errors"

type ObservabilityError struct { Code string; Message string; Cause error }

func (e *ObservabilityError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ObservabilityError) Is(target error) bool { _, ok := target.(*ObservabilityError); return ok }
func (e *ObservabilityError) Unwrap() error { return e.Cause }

var (
    ErrObservabilityNotFound     = &ObservabilityError{Code: "observability_not_found", Message: "observability: not found"}
    ErrObservabilityInvalidInput = &ObservabilityError{Code: "observability_invalid_input", Message: "observability: invalid input"}
    ErrObservabilityConflict     = &ObservabilityError{Code: "observability_conflict", Message: "observability: conflict"}
    ErrObservabilityUnauthorized = &ObservabilityError{Code: "observability_unauthorized", Message: "observability: unauthorized"}
    ErrObservabilityInternal     = &ObservabilityError{Code: "observability_internal", Message: "observability: internal error"}
)

func NewObservabilityError(code, msg string) error { return &ObservabilityError{Code: code, Message: msg} }
func IsObservabilityNotFound(err error) bool { return errors.Is(err, ErrObservabilityNotFound) }
