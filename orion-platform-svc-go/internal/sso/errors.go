package sso

import "errors"

type SsoError struct { Code string; Message string; Cause error }

func (e *SsoError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *SsoError) Is(target error) bool { _, ok := target.(*SsoError); return ok }
func (e *SsoError) Unwrap() error { return e.Cause }

var (
    ErrSsoNotFound     = &SsoError{Code: "sso_not_found", Message: "sso: not found"}
    ErrSsoInvalidInput = &SsoError{Code: "sso_invalid_input", Message: "sso: invalid input"}
    ErrSsoConflict     = &SsoError{Code: "sso_conflict", Message: "sso: conflict"}
    ErrSsoUnauthorized = &SsoError{Code: "sso_unauthorized", Message: "sso: unauthorized"}
    ErrSsoInternal     = &SsoError{Code: "sso_internal", Message: "sso: internal error"}
)

func NewSsoError(code, msg string) error { return &SsoError{Code: code, Message: msg} }
func IsSsoNotFound(err error) bool { return errors.Is(err, ErrSsoNotFound) }
