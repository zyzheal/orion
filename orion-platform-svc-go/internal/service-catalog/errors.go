package servicecatalog

import "errors"

type ServiceCatalogError struct { Code string; Message string; Cause error }

func (e *ServiceCatalogError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ServiceCatalogError) Is(target error) bool { _, ok := target.(*ServiceCatalogError); return ok }
func (e *ServiceCatalogError) Unwrap() error { return e.Cause }

var (
    ErrServiceCatalogNotFound     = &ServiceCatalogError{Code: "servicecatalog_not_found", Message: "service-catalog: not found"}
    ErrServiceCatalogInvalidInput = &ServiceCatalogError{Code: "servicecatalog_invalid_input", Message: "service-catalog: invalid input"}
    ErrServiceCatalogConflict     = &ServiceCatalogError{Code: "servicecatalog_conflict", Message: "service-catalog: conflict"}
    ErrServiceCatalogUnauthorized = &ServiceCatalogError{Code: "servicecatalog_unauthorized", Message: "service-catalog: unauthorized"}
    ErrServiceCatalogInternal     = &ServiceCatalogError{Code: "servicecatalog_internal", Message: "service-catalog: internal error"}
)

func NewServiceCatalogError(code, msg string) error { return &ServiceCatalogError{Code: code, Message: msg} }
func IsServiceCatalogNotFound(err error) bool { return errors.Is(err, ErrServiceCatalogNotFound) }
