package notificationtemplate

import "errors"

type NotificationTemplateError struct { Code string; Message string; Cause error }

func (e *NotificationTemplateError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *NotificationTemplateError) Is(target error) bool { _, ok := target.(*NotificationTemplateError); return ok }
func (e *NotificationTemplateError) Unwrap() error { return e.Cause }

var (
    ErrNotificationTemplateNotFound     = &NotificationTemplateError{Code: "notificationtemplate_not_found", Message: "notification-template: not found"}
    ErrNotificationTemplateInvalidInput = &NotificationTemplateError{Code: "notificationtemplate_invalid_input", Message: "notification-template: invalid input"}
    ErrNotificationTemplateConflict     = &NotificationTemplateError{Code: "notificationtemplate_conflict", Message: "notification-template: conflict"}
    ErrNotificationTemplateUnauthorized = &NotificationTemplateError{Code: "notificationtemplate_unauthorized", Message: "notification-template: unauthorized"}
    ErrNotificationTemplateInternal     = &NotificationTemplateError{Code: "notificationtemplate_internal", Message: "notification-template: internal error"}
)

func NewNotificationTemplateError(code, msg string) error { return &NotificationTemplateError{Code: code, Message: msg} }
func IsNotificationTemplateNotFound(err error) bool { return errors.Is(err, ErrNotificationTemplateNotFound) }
