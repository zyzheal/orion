package eventtriggerregistry

import "errors"

type EventTriggerRegistryError struct { Code string; Message string; Cause error }

func (e *EventTriggerRegistryError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *EventTriggerRegistryError) Is(target error) bool { _, ok := target.(*EventTriggerRegistryError); return ok }
func (e *EventTriggerRegistryError) Unwrap() error { return e.Cause }

var (
    ErrEventTriggerRegistryNotFound     = &EventTriggerRegistryError{Code: "eventtriggerregistry_not_found", Message: "event-trigger-registry: not found"}
    ErrEventTriggerRegistryInvalidInput = &EventTriggerRegistryError{Code: "eventtriggerregistry_invalid_input", Message: "event-trigger-registry: invalid input"}
    ErrEventTriggerRegistryConflict     = &EventTriggerRegistryError{Code: "eventtriggerregistry_conflict", Message: "event-trigger-registry: conflict"}
    ErrEventTriggerRegistryUnauthorized = &EventTriggerRegistryError{Code: "eventtriggerregistry_unauthorized", Message: "event-trigger-registry: unauthorized"}
    ErrEventTriggerRegistryInternal     = &EventTriggerRegistryError{Code: "eventtriggerregistry_internal", Message: "event-trigger-registry: internal error"}
)

func NewEventTriggerRegistryError(code, msg string) error { return &EventTriggerRegistryError{Code: code, Message: msg} }
func IsEventTriggerRegistryNotFound(err error) bool { return errors.Is(err, ErrEventTriggerRegistryNotFound) }
