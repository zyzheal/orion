package changeintelligence

import "errors"

type ChangeIntelligenceError struct { Code string; Message string; Cause error }

func (e *ChangeIntelligenceError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ChangeIntelligenceError) Is(target error) bool { _, ok := target.(*ChangeIntelligenceError); return ok }
func (e *ChangeIntelligenceError) Unwrap() error { return e.Cause }

var (
    ErrChangeIntelligenceNotFound     = &ChangeIntelligenceError{Code: "changeintelligence_not_found", Message: "change-intelligence: not found"}
    ErrChangeIntelligenceInvalidInput = &ChangeIntelligenceError{Code: "changeintelligence_invalid_input", Message: "change-intelligence: invalid input"}
    ErrChangeIntelligenceConflict     = &ChangeIntelligenceError{Code: "changeintelligence_conflict", Message: "change-intelligence: conflict"}
    ErrChangeIntelligenceUnauthorized = &ChangeIntelligenceError{Code: "changeintelligence_unauthorized", Message: "change-intelligence: unauthorized"}
    ErrChangeIntelligenceInternal     = &ChangeIntelligenceError{Code: "changeintelligence_internal", Message: "change-intelligence: internal error"}
)

func NewChangeIntelligenceError(code, msg string) error { return &ChangeIntelligenceError{Code: code, Message: msg} }
func IsChangeIntelligenceNotFound(err error) bool { return errors.Is(err, ErrChangeIntelligenceNotFound) }
