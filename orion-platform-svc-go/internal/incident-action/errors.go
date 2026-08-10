package incidentaction

import "errors"

type IncidentActionError struct { Code string; Message string; Cause error }

func (e *IncidentActionError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *IncidentActionError) Is(target error) bool { _, ok := target.(*IncidentActionError); return ok }
func (e *IncidentActionError) Unwrap() error { return e.Cause }

var (
    ErrIncidentActionNotFound     = &IncidentActionError{Code: "incidentaction_not_found", Message: "incident-action: not found"}
    ErrIncidentActionInvalidInput = &IncidentActionError{Code: "incidentaction_invalid_input", Message: "incident-action: invalid input"}
    ErrIncidentActionConflict     = &IncidentActionError{Code: "incidentaction_conflict", Message: "incident-action: conflict"}
    ErrIncidentActionUnauthorized = &IncidentActionError{Code: "incidentaction_unauthorized", Message: "incident-action: unauthorized"}
    ErrIncidentActionInternal     = &IncidentActionError{Code: "incidentaction_internal", Message: "incident-action: internal error"}
)

func NewIncidentActionError(code, msg string) error { return &IncidentActionError{Code: code, Message: msg} }
func IsIncidentActionNotFound(err error) bool { return errors.Is(err, ErrIncidentActionNotFound) }
