package eventtrigger

import "errors"

type EventTriggerError struct { Code string; Message string; Cause error }

func (e *EventTriggerError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *EventTriggerError) Is(target error) bool { _, ok := target.(*EventTriggerError); return ok }
func (e *EventTriggerError) Unwrap() error { return e.Cause }

var (
    ErrEventTriggerNotFound     = &EventTriggerError{Code: "eventtrigger_not_found", Message: "event-trigger: not found"}
    ErrEventTriggerInvalidInput = &EventTriggerError{Code: "eventtrigger_invalid_input", Message: "event-trigger: invalid input"}
    ErrEventTriggerConflict     = &EventTriggerError{Code: "eventtrigger_conflict", Message: "event-trigger: conflict"}
    ErrEventTriggerUnauthorized = &EventTriggerError{Code: "eventtrigger_unauthorized", Message: "event-trigger: unauthorized"}
    ErrEventTriggerInternal     = &EventTriggerError{Code: "eventtrigger_internal", Message: "event-trigger: internal error"}
)

func NewEventTriggerError(code, msg string) error { return &EventTriggerError{Code: code, Message: msg} }
func IsEventTriggerNotFound(err error) bool { return errors.Is(err, ErrEventTriggerNotFound) }
