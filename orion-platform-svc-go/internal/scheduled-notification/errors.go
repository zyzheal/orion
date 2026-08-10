package schedulednotification

import "errors"

type ScheduledNotificationError struct { Code string; Message string; Cause error }

func (e *ScheduledNotificationError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ScheduledNotificationError) Is(target error) bool { _, ok := target.(*ScheduledNotificationError); return ok }
func (e *ScheduledNotificationError) Unwrap() error { return e.Cause }

var (
    ErrScheduledNotificationNotFound     = &ScheduledNotificationError{Code: "schedulednotification_not_found", Message: "scheduled-notification: not found"}
    ErrScheduledNotificationInvalidInput = &ScheduledNotificationError{Code: "schedulednotification_invalid_input", Message: "scheduled-notification: invalid input"}
    ErrScheduledNotificationConflict     = &ScheduledNotificationError{Code: "schedulednotification_conflict", Message: "scheduled-notification: conflict"}
    ErrScheduledNotificationUnauthorized = &ScheduledNotificationError{Code: "schedulednotification_unauthorized", Message: "scheduled-notification: unauthorized"}
    ErrScheduledNotificationInternal     = &ScheduledNotificationError{Code: "schedulednotification_internal", Message: "scheduled-notification: internal error"}
)

func NewScheduledNotificationError(code, msg string) error { return &ScheduledNotificationError{Code: code, Message: msg} }
func IsScheduledNotificationNotFound(err error) bool { return errors.Is(err, ErrScheduledNotificationNotFound) }
