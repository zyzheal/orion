package session

import "errors"

type SessionError struct { Code string; Message string; Cause error }

func (e *SessionError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *SessionError) Is(target error) bool { _, ok := target.(*SessionError); return ok }
func (e *SessionError) Unwrap() error { return e.Cause }

var (
    ErrSessionNotFound     = &SessionError{Code: "session_not_found", Message: "session: not found"}
    ErrSessionInvalidInput = &SessionError{Code: "session_invalid_input", Message: "session: invalid input"}
    ErrSessionConflict     = &SessionError{Code: "session_conflict", Message: "session: conflict"}
    ErrSessionUnauthorized = &SessionError{Code: "session_unauthorized", Message: "session: unauthorized"}
    ErrSessionInternal     = &SessionError{Code: "session_internal", Message: "session: internal error"}
)

func NewSessionError(code, msg string) error { return &SessionError{Code: code, Message: msg} }
func IsSessionNotFound(err error) bool { return errors.Is(err, ErrSessionNotFound) }
