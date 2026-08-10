package ssounified

import "errors"

type SsoUnifiedError struct { Code string; Message string; Cause error }

func (e *SsoUnifiedError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *SsoUnifiedError) Is(target error) bool { _, ok := target.(*SsoUnifiedError); return ok }
func (e *SsoUnifiedError) Unwrap() error { return e.Cause }

var (
    ErrSsoUnifiedNotFound     = &SsoUnifiedError{Code: "ssounified_not_found", Message: "sso-unified: not found"}
    ErrSsoUnifiedInvalidInput = &SsoUnifiedError{Code: "ssounified_invalid_input", Message: "sso-unified: invalid input"}
    ErrSsoUnifiedConflict     = &SsoUnifiedError{Code: "ssounified_conflict", Message: "sso-unified: conflict"}
    ErrSsoUnifiedUnauthorized = &SsoUnifiedError{Code: "ssounified_unauthorized", Message: "sso-unified: unauthorized"}
    ErrSsoUnifiedInternal     = &SsoUnifiedError{Code: "ssounified_internal", Message: "sso-unified: internal error"}
)

func NewSsoUnifiedError(code, msg string) error { return &SsoUnifiedError{Code: code, Message: msg} }
func IsSsoUnifiedNotFound(err error) bool { return errors.Is(err, ErrSsoUnifiedNotFound) }
