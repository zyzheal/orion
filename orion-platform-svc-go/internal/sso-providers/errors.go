package ssoproviders

import "errors"

type SsoProvidersError struct { Code string; Message string; Cause error }

func (e *SsoProvidersError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *SsoProvidersError) Is(target error) bool { _, ok := target.(*SsoProvidersError); return ok }
func (e *SsoProvidersError) Unwrap() error { return e.Cause }

var (
    ErrSsoProvidersNotFound     = &SsoProvidersError{Code: "ssoproviders_not_found", Message: "sso-providers: not found"}
    ErrSsoProvidersInvalidInput = &SsoProvidersError{Code: "ssoproviders_invalid_input", Message: "sso-providers: invalid input"}
    ErrSsoProvidersConflict     = &SsoProvidersError{Code: "ssoproviders_conflict", Message: "sso-providers: conflict"}
    ErrSsoProvidersUnauthorized = &SsoProvidersError{Code: "ssoproviders_unauthorized", Message: "sso-providers: unauthorized"}
    ErrSsoProvidersInternal     = &SsoProvidersError{Code: "ssoproviders_internal", Message: "sso-providers: internal error"}
)

func NewSsoProvidersError(code, msg string) error { return &SsoProvidersError{Code: code, Message: msg} }
func IsSsoProvidersNotFound(err error) bool { return errors.Is(err, ErrSsoProvidersNotFound) }
