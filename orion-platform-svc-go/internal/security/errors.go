package security

import "errors"

// SecurityError represents domain errors for the security module.
type SecurityError struct {
    Code    string
    Message string
    Cause   error
}

func (e *SecurityError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *SecurityError) Is(target error) bool {
    _, ok := target.(*SecurityError)
    return ok
}

func (e *SecurityError) Unwrap() error {
    return e.Cause
}

var (
    ErrSecurityNotFound     = &SecurityError{Code: "security_not_found", Message: "security: resource not found"}
    ErrSecurityInvalidInput = &SecurityError{Code: "security_invalid_input", Message: "security: invalid input"}
    ErrSecurityConflict     = &SecurityError{Code: "security_conflict", Message: "security: resource conflict"}
    ErrSecurityUnauthorized = &SecurityError{Code: "security_unauthorized", Message: "security: unauthorized access"}
    ErrSecurityInternal     = &SecurityError{Code: "security_internal", Message: "security: internal error"}
)

func NewSecurityError(code, message string) error {
    return &SecurityError{Code: code, Message: message}
}

func IsSecurityNotFound(err error) bool {
    return errors.Is(err, ErrSecurityNotFound)
}
