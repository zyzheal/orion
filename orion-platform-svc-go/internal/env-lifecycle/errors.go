package envlifecycle

import "errors"

type EnvLifecycleError struct { Code string; Message string; Cause error }

func (e *EnvLifecycleError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *EnvLifecycleError) Is(target error) bool { _, ok := target.(*EnvLifecycleError); return ok }
func (e *EnvLifecycleError) Unwrap() error { return e.Cause }

var (
    ErrEnvLifecycleNotFound     = &EnvLifecycleError{Code: "envlifecycle_not_found", Message: "env-lifecycle: not found"}
    ErrEnvLifecycleInvalidInput = &EnvLifecycleError{Code: "envlifecycle_invalid_input", Message: "env-lifecycle: invalid input"}
    ErrEnvLifecycleConflict     = &EnvLifecycleError{Code: "envlifecycle_conflict", Message: "env-lifecycle: conflict"}
    ErrEnvLifecycleUnauthorized = &EnvLifecycleError{Code: "envlifecycle_unauthorized", Message: "env-lifecycle: unauthorized"}
    ErrEnvLifecycleInternal     = &EnvLifecycleError{Code: "envlifecycle_internal", Message: "env-lifecycle: internal error"}
)

func NewEnvLifecycleError(code, msg string) error { return &EnvLifecycleError{Code: code, Message: msg} }
func IsEnvLifecycleNotFound(err error) bool { return errors.Is(err, ErrEnvLifecycleNotFound) }
