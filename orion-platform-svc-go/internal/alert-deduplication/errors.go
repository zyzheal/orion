package alertdeduplication

import "errors"

type AlertDeduplicationError struct { Code string; Message string; Cause error }

func (e *AlertDeduplicationError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *AlertDeduplicationError) Is(target error) bool { _, ok := target.(*AlertDeduplicationError); return ok }
func (e *AlertDeduplicationError) Unwrap() error { return e.Cause }

var (
    ErrAlertDeduplicationNotFound     = &AlertDeduplicationError{Code: "alertdeduplication_not_found", Message: "alert-deduplication: not found"}
    ErrAlertDeduplicationInvalidInput = &AlertDeduplicationError{Code: "alertdeduplication_invalid_input", Message: "alert-deduplication: invalid input"}
    ErrAlertDeduplicationConflict     = &AlertDeduplicationError{Code: "alertdeduplication_conflict", Message: "alert-deduplication: conflict"}
    ErrAlertDeduplicationUnauthorized = &AlertDeduplicationError{Code: "alertdeduplication_unauthorized", Message: "alert-deduplication: unauthorized"}
    ErrAlertDeduplicationInternal     = &AlertDeduplicationError{Code: "alertdeduplication_internal", Message: "alert-deduplication: internal error"}
)

func NewAlertDeduplicationError(code, msg string) error { return &AlertDeduplicationError{Code: code, Message: msg} }
func IsAlertDeduplicationNotFound(err error) bool { return errors.Is(err, ErrAlertDeduplicationNotFound) }
