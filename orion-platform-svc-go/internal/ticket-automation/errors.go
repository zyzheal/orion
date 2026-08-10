package ticketautomation

import "errors"

type TicketAutomationError struct { Code string; Message string; Cause error }

func (e *TicketAutomationError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *TicketAutomationError) Is(target error) bool { _, ok := target.(*TicketAutomationError); return ok }
func (e *TicketAutomationError) Unwrap() error { return e.Cause }

var (
    ErrTicketAutomationNotFound     = &TicketAutomationError{Code: "ticketautomation_not_found", Message: "ticket-automation: not found"}
    ErrTicketAutomationInvalidInput = &TicketAutomationError{Code: "ticketautomation_invalid_input", Message: "ticket-automation: invalid input"}
    ErrTicketAutomationConflict     = &TicketAutomationError{Code: "ticketautomation_conflict", Message: "ticket-automation: conflict"}
    ErrTicketAutomationUnauthorized = &TicketAutomationError{Code: "ticketautomation_unauthorized", Message: "ticket-automation: unauthorized"}
    ErrTicketAutomationInternal     = &TicketAutomationError{Code: "ticketautomation_internal", Message: "ticket-automation: internal error"}
)

func NewTicketAutomationError(code, msg string) error { return &TicketAutomationError{Code: code, Message: msg} }
func IsTicketAutomationNotFound(err error) bool { return errors.Is(err, ErrTicketAutomationNotFound) }
