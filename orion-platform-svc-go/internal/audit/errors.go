package audit

import "errors"

// AuditError represents domain errors for the audit module.
type AuditError struct {
    Code    string
    Message string
    Cause   error
}

func (e *AuditError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *AuditError) Is(target error) bool {
    _, ok := target.(*AuditError)
    return ok
}

func (e *AuditError) Unwrap() error {
    return e.Cause
}

var (
    ErrAuditNotFound     = &AuditError{Code: "audit_not_found", Message: "audit: resource not found"}
    ErrAuditInvalidInput = &AuditError{Code: "audit_invalid_input", Message: "audit: invalid input"}
    ErrAuditConflict     = &AuditError{Code: "audit_conflict", Message: "audit: resource conflict"}
    ErrAuditUnauthorized = &AuditError{Code: "audit_unauthorized", Message: "audit: unauthorized access"}
    ErrAuditInternal     = &AuditError{Code: "audit_internal", Message: "audit: internal error"}
)

func NewAuditError(code, message string) error {
    return &AuditError{Code: code, Message: message}
}

func IsAuditNotFound(err error) bool {
    return errors.Is(err, ErrAuditNotFound)
}
