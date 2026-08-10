package intelligence

import "errors"

type IntelligenceError struct { Code string; Message string; Cause error }

func (e *IntelligenceError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *IntelligenceError) Is(target error) bool { _, ok := target.(*IntelligenceError); return ok }
func (e *IntelligenceError) Unwrap() error { return e.Cause }

var (
    ErrIntelligenceNotFound     = &IntelligenceError{Code: "intelligence_not_found", Message: "intelligence: not found"}
    ErrIntelligenceInvalidInput = &IntelligenceError{Code: "intelligence_invalid_input", Message: "intelligence: invalid input"}
    ErrIntelligenceConflict     = &IntelligenceError{Code: "intelligence_conflict", Message: "intelligence: conflict"}
    ErrIntelligenceUnauthorized = &IntelligenceError{Code: "intelligence_unauthorized", Message: "intelligence: unauthorized"}
    ErrIntelligenceInternal     = &IntelligenceError{Code: "intelligence_internal", Message: "intelligence: internal error"}
)

func NewIntelligenceError(code, msg string) error { return &IntelligenceError{Code: code, Message: msg} }
func IsIntelligenceNotFound(err error) bool { return errors.Is(err, ErrIntelligenceNotFound) }
