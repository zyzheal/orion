package integrationhandler

import "errors"

type IntegrationHandlerError struct { Code string; Message string; Cause error }

func (e *IntegrationHandlerError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *IntegrationHandlerError) Is(target error) bool { _, ok := target.(*IntegrationHandlerError); return ok }
func (e *IntegrationHandlerError) Unwrap() error { return e.Cause }

var (
    ErrIntegrationHandlerNotFound     = &IntegrationHandlerError{Code: "integrationhandler_not_found", Message: "integration-handler: not found"}
    ErrIntegrationHandlerInvalidInput = &IntegrationHandlerError{Code: "integrationhandler_invalid_input", Message: "integration-handler: invalid input"}
    ErrIntegrationHandlerConflict     = &IntegrationHandlerError{Code: "integrationhandler_conflict", Message: "integration-handler: conflict"}
    ErrIntegrationHandlerUnauthorized = &IntegrationHandlerError{Code: "integrationhandler_unauthorized", Message: "integration-handler: unauthorized"}
    ErrIntegrationHandlerInternal     = &IntegrationHandlerError{Code: "integrationhandler_internal", Message: "integration-handler: internal error"}
)

func NewIntegrationHandlerError(code, msg string) error { return &IntegrationHandlerError{Code: code, Message: msg} }
func IsIntegrationHandlerNotFound(err error) bool { return errors.Is(err, ErrIntegrationHandlerNotFound) }
