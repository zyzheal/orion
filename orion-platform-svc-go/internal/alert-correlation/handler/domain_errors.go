package handler

type AlertCorrelationError struct { Code string; Message string; Cause error }

func (e *AlertCorrelationError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}
func (e *AlertCorrelationError) Is(target error) bool { _, ok := target.(*AlertCorrelationError); return ok }
func (e *AlertCorrelationError) Unwrap() error { return e.Cause }

var (
    ErrAlertCorrelationNotFound     = &AlertCorrelationError{Code: "alert_correlation_not_found", Message: "alert-correlation: not found"}
    ErrAlertCorrelationInvalidInput = &AlertCorrelationError{Code: "alert_correlation_invalid_input", Message: "alert-correlation: invalid input"}
    ErrAlertCorrelationConflict     = &AlertCorrelationError{Code: "alert_correlation_conflict", Message: "alert-correlation: conflict"}
    ErrAlertCorrelationUnauthorized = &AlertCorrelationError{Code: "alert_correlation_unauthorized", Message: "alert-correlation: unauthorized"}
    ErrAlertCorrelationInternal     = &AlertCorrelationError{Code: "alert_correlation_internal", Message: "alert-correlation: internal error"}
)

func NewAlertCorrelationError(code, msg string) error { return &AlertCorrelationError{Code: code, Message: msg} }
