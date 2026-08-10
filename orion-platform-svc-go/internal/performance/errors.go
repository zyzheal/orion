package performance

import "errors"

type PerformanceError struct { Code string; Message string; Cause error }

func (e *PerformanceError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *PerformanceError) Is(target error) bool { _, ok := target.(*PerformanceError); return ok }
func (e *PerformanceError) Unwrap() error { return e.Cause }

var (
    ErrPerformanceNotFound     = &PerformanceError{Code: "performance_not_found", Message: "performance: not found"}
    ErrPerformanceInvalidInput = &PerformanceError{Code: "performance_invalid_input", Message: "performance: invalid input"}
    ErrPerformanceConflict     = &PerformanceError{Code: "performance_conflict", Message: "performance: conflict"}
    ErrPerformanceUnauthorized = &PerformanceError{Code: "performance_unauthorized", Message: "performance: unauthorized"}
    ErrPerformanceInternal     = &PerformanceError{Code: "performance_internal", Message: "performance: internal error"}
)

func NewPerformanceError(code, msg string) error { return &PerformanceError{Code: code, Message: msg} }
func IsPerformanceNotFound(err error) bool { return errors.Is(err, ErrPerformanceNotFound) }
