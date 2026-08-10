package ticketknowledge

import "errors"

type TicketKnowledgeError struct { Code string; Message string; Cause error }

func (e *TicketKnowledgeError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *TicketKnowledgeError) Is(target error) bool { _, ok := target.(*TicketKnowledgeError); return ok }
func (e *TicketKnowledgeError) Unwrap() error { return e.Cause }

var (
    ErrTicketKnowledgeNotFound     = &TicketKnowledgeError{Code: "ticketknowledge_not_found", Message: "ticket-knowledge: not found"}
    ErrTicketKnowledgeInvalidInput = &TicketKnowledgeError{Code: "ticketknowledge_invalid_input", Message: "ticket-knowledge: invalid input"}
    ErrTicketKnowledgeConflict     = &TicketKnowledgeError{Code: "ticketknowledge_conflict", Message: "ticket-knowledge: conflict"}
    ErrTicketKnowledgeUnauthorized = &TicketKnowledgeError{Code: "ticketknowledge_unauthorized", Message: "ticket-knowledge: unauthorized"}
    ErrTicketKnowledgeInternal     = &TicketKnowledgeError{Code: "ticketknowledge_internal", Message: "ticket-knowledge: internal error"}
)

func NewTicketKnowledgeError(code, msg string) error { return &TicketKnowledgeError{Code: code, Message: msg} }
func IsTicketKnowledgeNotFound(err error) bool { return errors.Is(err, ErrTicketKnowledgeNotFound) }
