package sprint

import "errors"

type SprintError struct { Code string; Message string; Cause error }

func (e *SprintError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *SprintError) Is(target error) bool { _, ok := target.(*SprintError); return ok }
func (e *SprintError) Unwrap() error { return e.Cause }

var (
    ErrSprintNotFound     = &SprintError{Code: "sprint_not_found", Message: "sprint: not found"}
    ErrSprintInvalidInput = &SprintError{Code: "sprint_invalid_input", Message: "sprint: invalid input"}
    ErrSprintConflict     = &SprintError{Code: "sprint_conflict", Message: "sprint: conflict"}
    ErrSprintUnauthorized = &SprintError{Code: "sprint_unauthorized", Message: "sprint: unauthorized"}
    ErrSprintInternal     = &SprintError{Code: "sprint_internal", Message: "sprint: internal error"}
)

func NewSprintError(code, msg string) error { return &SprintError{Code: code, Message: msg} }
func IsSprintNotFound(err error) bool { return errors.Is(err, ErrSprintNotFound) }
