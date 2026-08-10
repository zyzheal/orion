package handler

import "errors"

type AlertError struct {
	Code    string
	Message string
	Cause   error
}

func (e *AlertError) Error() string {
	if e.Cause != nil {
		return e.Message + ": " + e.Cause.Error()
	}
	return e.Message
}

func (e *AlertError) Is(target error) bool {
	_, ok := target.(*AlertError)
	return ok
}

func (e *AlertError) Unwrap() error { return e.Cause }

var (
	ErrAlertNotFound     = &AlertError{Code: "alert_not_found", Message: "alert: not found"}
	ErrAlertInvalidInput = &AlertError{Code: "alert_invalid_input", Message: "alert: invalid input"}
	ErrAlertConflict     = &AlertError{Code: "alert_conflict", Message: "alert: conflict"}
	ErrAlertUnauthorized = &AlertError{Code: "alert_unauthorized", Message: "alert: unauthorized"}
	ErrAlertInternal     = &AlertError{Code: "alert_internal", Message: "alert: internal error"}
)

func NewAlertError(code, message string) error { return &AlertError{Code: code, Message: message} }
func IsAlertNotFound(err error) bool { return errors.Is(err, ErrAlertNotFound) }
