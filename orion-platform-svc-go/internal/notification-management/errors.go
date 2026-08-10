package notificationmanagement

import "errors"

type NotificationManagementError struct { Code string; Message string; Cause error }

func (e *NotificationManagementError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *NotificationManagementError) Is(target error) bool { _, ok := target.(*NotificationManagementError); return ok }
func (e *NotificationManagementError) Unwrap() error { return e.Cause }

var (
    ErrNotificationManagementNotFound     = &NotificationManagementError{Code: "notificationmanagement_not_found", Message: "notification-management: not found"}
    ErrNotificationManagementInvalidInput = &NotificationManagementError{Code: "notificationmanagement_invalid_input", Message: "notification-management: invalid input"}
    ErrNotificationManagementConflict     = &NotificationManagementError{Code: "notificationmanagement_conflict", Message: "notification-management: conflict"}
    ErrNotificationManagementUnauthorized = &NotificationManagementError{Code: "notificationmanagement_unauthorized", Message: "notification-management: unauthorized"}
    ErrNotificationManagementInternal     = &NotificationManagementError{Code: "notificationmanagement_internal", Message: "notification-management: internal error"}
)

func NewNotificationManagementError(code, msg string) error { return &NotificationManagementError{Code: code, Message: msg} }
func IsNotificationManagementNotFound(err error) bool { return errors.Is(err, ErrNotificationManagementNotFound) }
