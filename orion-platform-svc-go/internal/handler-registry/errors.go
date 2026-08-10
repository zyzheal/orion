package handlerregistry

import "errors"

type HandlerRegistryError struct { Code string; Message string; Cause error }

func (e *HandlerRegistryError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *HandlerRegistryError) Is(target error) bool { _, ok := target.(*HandlerRegistryError); return ok }
func (e *HandlerRegistryError) Unwrap() error { return e.Cause }

var (
    ErrHandlerRegistryNotFound     = &HandlerRegistryError{Code: "handlerregistry_not_found", Message: "handler-registry: not found"}
    ErrHandlerRegistryInvalidInput = &HandlerRegistryError{Code: "handlerregistry_invalid_input", Message: "handler-registry: invalid input"}
    ErrHandlerRegistryConflict     = &HandlerRegistryError{Code: "handlerregistry_conflict", Message: "handler-registry: conflict"}
    ErrHandlerRegistryUnauthorized = &HandlerRegistryError{Code: "handlerregistry_unauthorized", Message: "handler-registry: unauthorized"}
    ErrHandlerRegistryInternal     = &HandlerRegistryError{Code: "handlerregistry_internal", Message: "handler-registry: internal error"}
)

func NewHandlerRegistryError(code, msg string) error { return &HandlerRegistryError{Code: code, Message: msg} }
func IsHandlerRegistryNotFound(err error) bool { return errors.Is(err, ErrHandlerRegistryNotFound) }
