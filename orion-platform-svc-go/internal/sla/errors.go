package sla

import "errors"

// SlaError represents domain errors for the sla module.
type SlaError struct {
    Code    string
    Message string
    Cause   error
}

func (e *SlaError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *SlaError) Is(target error) bool {
    _, ok := target.(*SlaError)
    return ok
}

func (e *SlaError) Unwrap() error {
    return e.Cause
}

var (
    ErrSlaNotFound     = &SlaError{Code: "sla_not_found", Message: "sla: resource not found"}
    ErrSlaInvalidInput = &SlaError{Code: "sla_invalid_input", Message: "sla: invalid input"}
    ErrSlaConflict     = &SlaError{Code: "sla_conflict", Message: "sla: resource conflict"}
    ErrSlaUnauthorized = &SlaError{Code: "sla_unauthorized", Message: "sla: unauthorized access"}
    ErrSlaInternal     = &SlaError{Code: "sla_internal", Message: "sla: internal error"}
)

func NewSlaError(code, message string) error {
    return &SlaError{Code: code, Message: message}
}

func IsSlaNotFound(err error) bool {
    return errors.Is(err, ErrSlaNotFound)
}
