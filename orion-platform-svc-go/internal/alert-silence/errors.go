package alertsilence

import "errors"

type AlertSilenceError struct { Code string; Message string; Cause error }

func (e *AlertSilenceError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *AlertSilenceError) Is(target error) bool { _, ok := target.(*AlertSilenceError); return ok }
func (e *AlertSilenceError) Unwrap() error { return e.Cause }

var (
    ErrAlertSilenceNotFound     = &AlertSilenceError{Code: "alertsilence_not_found", Message: "alert-silence: not found"}
    ErrAlertSilenceInvalidInput = &AlertSilenceError{Code: "alertsilence_invalid_input", Message: "alert-silence: invalid input"}
    ErrAlertSilenceConflict     = &AlertSilenceError{Code: "alertsilence_conflict", Message: "alert-silence: conflict"}
    ErrAlertSilenceUnauthorized = &AlertSilenceError{Code: "alertsilence_unauthorized", Message: "alert-silence: unauthorized"}
    ErrAlertSilenceInternal     = &AlertSilenceError{Code: "alertsilence_internal", Message: "alert-silence: internal error"}
)

func NewAlertSilenceError(code, msg string) error { return &AlertSilenceError{Code: code, Message: msg} }
func IsAlertSilenceNotFound(err error) bool { return errors.Is(err, ErrAlertSilenceNotFound) }
