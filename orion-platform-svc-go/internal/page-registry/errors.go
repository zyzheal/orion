package pageregistry

import "errors"

type PageRegistryError struct { Code string; Message string; Cause error }

func (e *PageRegistryError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *PageRegistryError) Is(target error) bool { _, ok := target.(*PageRegistryError); return ok }
func (e *PageRegistryError) Unwrap() error { return e.Cause }

var (
    ErrPageRegistryNotFound     = &PageRegistryError{Code: "pageregistry_not_found", Message: "page-registry: not found"}
    ErrPageRegistryInvalidInput = &PageRegistryError{Code: "pageregistry_invalid_input", Message: "page-registry: invalid input"}
    ErrPageRegistryConflict     = &PageRegistryError{Code: "pageregistry_conflict", Message: "page-registry: conflict"}
    ErrPageRegistryUnauthorized = &PageRegistryError{Code: "pageregistry_unauthorized", Message: "page-registry: unauthorized"}
    ErrPageRegistryInternal     = &PageRegistryError{Code: "pageregistry_internal", Message: "page-registry: internal error"}
)

func NewPageRegistryError(code, msg string) error { return &PageRegistryError{Code: code, Message: msg} }
func IsPageRegistryNotFound(err error) bool { return errors.Is(err, ErrPageRegistryNotFound) }
