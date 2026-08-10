package serviceregistry

import "errors"

type ServiceRegistryError struct { Code string; Message string; Cause error }

func (e *ServiceRegistryError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ServiceRegistryError) Is(target error) bool { _, ok := target.(*ServiceRegistryError); return ok }
func (e *ServiceRegistryError) Unwrap() error { return e.Cause }

var (
    ErrServiceRegistryNotFound     = &ServiceRegistryError{Code: "serviceregistry_not_found", Message: "service-registry: not found"}
    ErrServiceRegistryInvalidInput = &ServiceRegistryError{Code: "serviceregistry_invalid_input", Message: "service-registry: invalid input"}
    ErrServiceRegistryConflict     = &ServiceRegistryError{Code: "serviceregistry_conflict", Message: "service-registry: conflict"}
    ErrServiceRegistryUnauthorized = &ServiceRegistryError{Code: "serviceregistry_unauthorized", Message: "service-registry: unauthorized"}
    ErrServiceRegistryInternal     = &ServiceRegistryError{Code: "serviceregistry_internal", Message: "service-registry: internal error"}
)

func NewServiceRegistryError(code, msg string) error { return &ServiceRegistryError{Code: code, Message: msg} }
func IsServiceRegistryNotFound(err error) bool { return errors.Is(err, ErrServiceRegistryNotFound) }
