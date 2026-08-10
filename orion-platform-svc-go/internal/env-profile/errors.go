package envprofile

import "errors"

type EnvProfileError struct { Code string; Message string; Cause error }

func (e *EnvProfileError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *EnvProfileError) Is(target error) bool { _, ok := target.(*EnvProfileError); return ok }
func (e *EnvProfileError) Unwrap() error { return e.Cause }

var (
    ErrEnvProfileNotFound     = &EnvProfileError{Code: "envprofile_not_found", Message: "env-profile: not found"}
    ErrEnvProfileInvalidInput = &EnvProfileError{Code: "envprofile_invalid_input", Message: "env-profile: invalid input"}
    ErrEnvProfileConflict     = &EnvProfileError{Code: "envprofile_conflict", Message: "env-profile: conflict"}
    ErrEnvProfileUnauthorized = &EnvProfileError{Code: "envprofile_unauthorized", Message: "env-profile: unauthorized"}
    ErrEnvProfileInternal     = &EnvProfileError{Code: "envprofile_internal", Message: "env-profile: internal error"}
)

func NewEnvProfileError(code, msg string) error { return &EnvProfileError{Code: code, Message: msg} }
func IsEnvProfileNotFound(err error) bool { return errors.Is(err, ErrEnvProfileNotFound) }
