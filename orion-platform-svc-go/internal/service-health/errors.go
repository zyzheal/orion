package servicehealth

import "errors"

type ServiceHealthError struct { Code string; Message string; Cause error }

func (e *ServiceHealthError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ServiceHealthError) Is(target error) bool { _, ok := target.(*ServiceHealthError); return ok }
func (e *ServiceHealthError) Unwrap() error { return e.Cause }

var (
    ErrServiceHealthNotFound     = &ServiceHealthError{Code: "servicehealth_not_found", Message: "service-health: not found"}
    ErrServiceHealthInvalidInput = &ServiceHealthError{Code: "servicehealth_invalid_input", Message: "service-health: invalid input"}
    ErrServiceHealthConflict     = &ServiceHealthError{Code: "servicehealth_conflict", Message: "service-health: conflict"}
    ErrServiceHealthUnauthorized = &ServiceHealthError{Code: "servicehealth_unauthorized", Message: "service-health: unauthorized"}
    ErrServiceHealthInternal     = &ServiceHealthError{Code: "servicehealth_internal", Message: "service-health: internal error"}
)

func NewServiceHealthError(code, msg string) error { return &ServiceHealthError{Code: code, Message: msg} }
func IsServiceHealthNotFound(err error) bool { return errors.Is(err, ErrServiceHealthNotFound) }
