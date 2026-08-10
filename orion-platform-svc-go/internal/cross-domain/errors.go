package crossdomain

import "errors"

type CrossDomainError struct { Code string; Message string; Cause error }

func (e *CrossDomainError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *CrossDomainError) Is(target error) bool { _, ok := target.(*CrossDomainError); return ok }
func (e *CrossDomainError) Unwrap() error { return e.Cause }

var (
    ErrCrossDomainNotFound     = &CrossDomainError{Code: "crossdomain_not_found", Message: "cross-domain: not found"}
    ErrCrossDomainInvalidInput = &CrossDomainError{Code: "crossdomain_invalid_input", Message: "cross-domain: invalid input"}
    ErrCrossDomainConflict     = &CrossDomainError{Code: "crossdomain_conflict", Message: "cross-domain: conflict"}
    ErrCrossDomainUnauthorized = &CrossDomainError{Code: "crossdomain_unauthorized", Message: "cross-domain: unauthorized"}
    ErrCrossDomainInternal     = &CrossDomainError{Code: "crossdomain_internal", Message: "cross-domain: internal error"}
)

func NewCrossDomainError(code, msg string) error { return &CrossDomainError{Code: code, Message: msg} }
func IsCrossDomainNotFound(err error) bool { return errors.Is(err, ErrCrossDomainNotFound) }
