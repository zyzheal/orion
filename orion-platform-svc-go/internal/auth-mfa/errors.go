package authmfa

import "errors"

type AuthMfaError struct { Code string; Message string; Cause error }

func (e *AuthMfaError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *AuthMfaError) Is(target error) bool { _, ok := target.(*AuthMfaError); return ok }
func (e *AuthMfaError) Unwrap() error { return e.Cause }

var (
    ErrAuthMfaNotFound     = &AuthMfaError{Code: "authmfa_not_found", Message: "auth-mfa: not found"}
    ErrAuthMfaInvalidInput = &AuthMfaError{Code: "authmfa_invalid_input", Message: "auth-mfa: invalid input"}
    ErrAuthMfaConflict     = &AuthMfaError{Code: "authmfa_conflict", Message: "auth-mfa: conflict"}
    ErrAuthMfaUnauthorized = &AuthMfaError{Code: "authmfa_unauthorized", Message: "auth-mfa: unauthorized"}
    ErrAuthMfaInternal     = &AuthMfaError{Code: "authmfa_internal", Message: "auth-mfa: internal error"}
)

func NewAuthMfaError(code, msg string) error { return &AuthMfaError{Code: code, Message: msg} }
func IsAuthMfaNotFound(err error) bool { return errors.Is(err, ErrAuthMfaNotFound) }
