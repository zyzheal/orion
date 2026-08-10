package metrics

import "errors"

type MetricsError struct { Code string; Message string; Cause error }

func (e *MetricsError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *MetricsError) Is(target error) bool { _, ok := target.(*MetricsError); return ok }
func (e *MetricsError) Unwrap() error { return e.Cause }

var (
    ErrMetricsNotFound     = &MetricsError{Code: "metrics_not_found", Message: "metrics: not found"}
    ErrMetricsInvalidInput = &MetricsError{Code: "metrics_invalid_input", Message: "metrics: invalid input"}
    ErrMetricsConflict     = &MetricsError{Code: "metrics_conflict", Message: "metrics: conflict"}
    ErrMetricsUnauthorized = &MetricsError{Code: "metrics_unauthorized", Message: "metrics: unauthorized"}
    ErrMetricsInternal     = &MetricsError{Code: "metrics_internal", Message: "metrics: internal error"}
)

func NewMetricsError(code, msg string) error { return &MetricsError{Code: code, Message: msg} }
func IsMetricsNotFound(err error) bool { return errors.Is(err, ErrMetricsNotFound) }
