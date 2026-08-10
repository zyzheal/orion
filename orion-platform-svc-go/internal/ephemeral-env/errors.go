package ephemeralenv

import "errors"

type EphemeralEnvError struct { Code string; Message string; Cause error }

func (e *EphemeralEnvError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *EphemeralEnvError) Is(target error) bool { _, ok := target.(*EphemeralEnvError); return ok }
func (e *EphemeralEnvError) Unwrap() error { return e.Cause }

var (
    ErrEphemeralEnvNotFound     = &EphemeralEnvError{Code: "ephemeralenv_not_found", Message: "ephemeral-env: not found"}
    ErrEphemeralEnvInvalidInput = &EphemeralEnvError{Code: "ephemeralenv_invalid_input", Message: "ephemeral-env: invalid input"}
    ErrEphemeralEnvConflict     = &EphemeralEnvError{Code: "ephemeralenv_conflict", Message: "ephemeral-env: conflict"}
    ErrEphemeralEnvUnauthorized = &EphemeralEnvError{Code: "ephemeralenv_unauthorized", Message: "ephemeral-env: unauthorized"}
    ErrEphemeralEnvInternal     = &EphemeralEnvError{Code: "ephemeralenv_internal", Message: "ephemeral-env: internal error"}
)

func NewEphemeralEnvError(code, msg string) error { return &EphemeralEnvError{Code: code, Message: msg} }
func IsEphemeralEnvNotFound(err error) bool { return errors.Is(err, ErrEphemeralEnvNotFound) }
