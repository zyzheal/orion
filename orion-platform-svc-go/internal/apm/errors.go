package apm

import "errors"

type ApmError struct { Code string; Message string; Cause error }

func (e *ApmError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ApmError) Is(target error) bool { _, ok := target.(*ApmError); return ok }
func (e *ApmError) Unwrap() error { return e.Cause }

var (
    ErrApmNotFound     = &ApmError{Code: "apm_not_found", Message: "apm: not found"}
    ErrApmInvalidInput = &ApmError{Code: "apm_invalid_input", Message: "apm: invalid input"}
    ErrApmConflict     = &ApmError{Code: "apm_conflict", Message: "apm: conflict"}
    ErrApmUnauthorized = &ApmError{Code: "apm_unauthorized", Message: "apm: unauthorized"}
    ErrApmInternal     = &ApmError{Code: "apm_internal", Message: "apm: internal error"}
)

func NewApmError(code, msg string) error { return &ApmError{Code: code, Message: msg} }
func IsApmNotFound(err error) bool { return errors.Is(err, ErrApmNotFound) }
