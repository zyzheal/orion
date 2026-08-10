package terminalaudit

import "errors"

type TerminalAuditError struct { Code string; Message string; Cause error }

func (e *TerminalAuditError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *TerminalAuditError) Is(target error) bool { _, ok := target.(*TerminalAuditError); return ok }
func (e *TerminalAuditError) Unwrap() error { return e.Cause }

var (
    ErrTerminalAuditNotFound     = &TerminalAuditError{Code: "terminalaudit_not_found", Message: "terminal-audit: not found"}
    ErrTerminalAuditInvalidInput = &TerminalAuditError{Code: "terminalaudit_invalid_input", Message: "terminal-audit: invalid input"}
    ErrTerminalAuditConflict     = &TerminalAuditError{Code: "terminalaudit_conflict", Message: "terminal-audit: conflict"}
    ErrTerminalAuditUnauthorized = &TerminalAuditError{Code: "terminalaudit_unauthorized", Message: "terminal-audit: unauthorized"}
    ErrTerminalAuditInternal     = &TerminalAuditError{Code: "terminalaudit_internal", Message: "terminal-audit: internal error"}
)

func NewTerminalAuditError(code, msg string) error { return &TerminalAuditError{Code: code, Message: msg} }
func IsTerminalAuditNotFound(err error) bool { return errors.Is(err, ErrTerminalAuditNotFound) }
