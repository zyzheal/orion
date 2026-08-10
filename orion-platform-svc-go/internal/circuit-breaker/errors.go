package circuitbreaker

import "errors"

type CircuitBreakerError struct { Code string; Message string; Cause error }

func (e *CircuitBreakerError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *CircuitBreakerError) Is(target error) bool { _, ok := target.(*CircuitBreakerError); return ok }
func (e *CircuitBreakerError) Unwrap() error { return e.Cause }

var (
    ErrCircuitBreakerNotFound     = &CircuitBreakerError{Code: "circuitbreaker_not_found", Message: "circuit-breaker: not found"}
    ErrCircuitBreakerInvalidInput = &CircuitBreakerError{Code: "circuitbreaker_invalid_input", Message: "circuit-breaker: invalid input"}
    ErrCircuitBreakerConflict     = &CircuitBreakerError{Code: "circuitbreaker_conflict", Message: "circuit-breaker: conflict"}
    ErrCircuitBreakerUnauthorized = &CircuitBreakerError{Code: "circuitbreaker_unauthorized", Message: "circuit-breaker: unauthorized"}
    ErrCircuitBreakerInternal     = &CircuitBreakerError{Code: "circuitbreaker_internal", Message: "circuit-breaker: internal error"}
)

func NewCircuitBreakerError(code, msg string) error { return &CircuitBreakerError{Code: code, Message: msg} }
func IsCircuitBreakerNotFound(err error) bool { return errors.Is(err, ErrCircuitBreakerNotFound) }
