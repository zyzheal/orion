package environment

import "errors"

type EnvironmentError struct { Code string; Message string; Cause error }

func (e *EnvironmentError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *EnvironmentError) Is(target error) bool { _, ok := target.(*EnvironmentError); return ok }
func (e *EnvironmentError) Unwrap() error { return e.Cause }

var (
    ErrEnvironmentNotFound     = &EnvironmentError{Code: "environment_not_found", Message: "environment: not found"}
    ErrEnvironmentInvalidInput = &EnvironmentError{Code: "environment_invalid_input", Message: "environment: invalid input"}
    ErrEnvironmentConflict     = &EnvironmentError{Code: "environment_conflict", Message: "environment: conflict"}
    ErrEnvironmentUnauthorized = &EnvironmentError{Code: "environment_unauthorized", Message: "environment: unauthorized"}
    ErrEnvironmentInternal     = &EnvironmentError{Code: "environment_internal", Message: "environment: internal error"}
)

func NewEnvironmentError(code, msg string) error { return &EnvironmentError{Code: code, Message: msg} }
func IsEnvironmentNotFound(err error) bool { return errors.Is(err, ErrEnvironmentNotFound) }
