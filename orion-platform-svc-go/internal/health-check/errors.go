package healthcheck

import "errors"

type HealthCheckError struct { Code string; Message string; Cause error }

func (e *HealthCheckError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *HealthCheckError) Is(target error) bool { _, ok := target.(*HealthCheckError); return ok }
func (e *HealthCheckError) Unwrap() error { return e.Cause }

var (
    ErrHealthCheckNotFound     = &HealthCheckError{Code: "healthcheck_not_found", Message: "health-check: not found"}
    ErrHealthCheckInvalidInput = &HealthCheckError{Code: "healthcheck_invalid_input", Message: "health-check: invalid input"}
    ErrHealthCheckConflict     = &HealthCheckError{Code: "healthcheck_conflict", Message: "health-check: conflict"}
    ErrHealthCheckUnauthorized = &HealthCheckError{Code: "healthcheck_unauthorized", Message: "health-check: unauthorized"}
    ErrHealthCheckInternal     = &HealthCheckError{Code: "healthcheck_internal", Message: "health-check: internal error"}
)

func NewHealthCheckError(code, msg string) error { return &HealthCheckError{Code: code, Message: msg} }
func IsHealthCheckNotFound(err error) bool { return errors.Is(err, ErrHealthCheckNotFound) }
