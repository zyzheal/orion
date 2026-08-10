package escalation

import "errors"

type EscalationError struct { Code string; Message string; Cause error }

func (e *EscalationError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *EscalationError) Is(target error) bool { _, ok := target.(*EscalationError); return ok }
func (e *EscalationError) Unwrap() error { return e.Cause }

var (
    ErrEscalationNotFound     = &EscalationError{Code: "escalation_not_found", Message: "escalation: not found"}
    ErrEscalationInvalidInput = &EscalationError{Code: "escalation_invalid_input", Message: "escalation: invalid input"}
    ErrEscalationConflict     = &EscalationError{Code: "escalation_conflict", Message: "escalation: conflict"}
    ErrEscalationUnauthorized = &EscalationError{Code: "escalation_unauthorized", Message: "escalation: unauthorized"}
    ErrEscalationInternal     = &EscalationError{Code: "escalation_internal", Message: "escalation: internal error"}
)

func NewEscalationError(code, msg string) error { return &EscalationError{Code: code, Message: msg} }
func IsEscalationNotFound(err error) bool { return errors.Is(err, ErrEscalationNotFound) }
