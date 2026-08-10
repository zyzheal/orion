package notificationpolicy

import "errors"

type NotificationPolicyError struct { Code string; Message string; Cause error }

func (e *NotificationPolicyError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *NotificationPolicyError) Is(target error) bool { _, ok := target.(*NotificationPolicyError); return ok }
func (e *NotificationPolicyError) Unwrap() error { return e.Cause }

var (
    ErrNotificationPolicyNotFound     = &NotificationPolicyError{Code: "notificationpolicy_not_found", Message: "notification-policy: not found"}
    ErrNotificationPolicyInvalidInput = &NotificationPolicyError{Code: "notificationpolicy_invalid_input", Message: "notification-policy: invalid input"}
    ErrNotificationPolicyConflict     = &NotificationPolicyError{Code: "notificationpolicy_conflict", Message: "notification-policy: conflict"}
    ErrNotificationPolicyUnauthorized = &NotificationPolicyError{Code: "notificationpolicy_unauthorized", Message: "notification-policy: unauthorized"}
    ErrNotificationPolicyInternal     = &NotificationPolicyError{Code: "notificationpolicy_internal", Message: "notification-policy: internal error"}
)

func NewNotificationPolicyError(code, msg string) error { return &NotificationPolicyError{Code: code, Message: msg} }
func IsNotificationPolicyNotFound(err error) bool { return errors.Is(err, ErrNotificationPolicyNotFound) }
