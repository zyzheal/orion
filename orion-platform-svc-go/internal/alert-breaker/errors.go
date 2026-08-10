package alertbreaker

import "errors"

type AlertBreakerError struct { Code string; Message string; Cause error }

func (e *AlertBreakerError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *AlertBreakerError) Is(target error) bool { _, ok := target.(*AlertBreakerError); return ok }
func (e *AlertBreakerError) Unwrap() error { return e.Cause }

var (
    ErrAlertBreakerNotFound     = &AlertBreakerError{Code: "alertbreaker_not_found", Message: "alert-breaker: not found"}
    ErrAlertBreakerInvalidInput = &AlertBreakerError{Code: "alertbreaker_invalid_input", Message: "alert-breaker: invalid input"}
    ErrAlertBreakerConflict     = &AlertBreakerError{Code: "alertbreaker_conflict", Message: "alert-breaker: conflict"}
    ErrAlertBreakerUnauthorized = &AlertBreakerError{Code: "alertbreaker_unauthorized", Message: "alert-breaker: unauthorized"}
    ErrAlertBreakerInternal     = &AlertBreakerError{Code: "alertbreaker_internal", Message: "alert-breaker: internal error"}
)

func NewAlertBreakerError(code, msg string) error { return &AlertBreakerError{Code: code, Message: msg} }
func IsAlertBreakerNotFound(err error) bool { return errors.Is(err, ErrAlertBreakerNotFound) }
