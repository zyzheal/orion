package selfservice

import "errors"

type SelfServiceError struct { Code string; Message string; Cause error }

func (e *SelfServiceError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *SelfServiceError) Is(target error) bool { _, ok := target.(*SelfServiceError); return ok }
func (e *SelfServiceError) Unwrap() error { return e.Cause }

var (
    ErrSelfServiceNotFound     = &SelfServiceError{Code: "selfservice_not_found", Message: "self-service: not found"}
    ErrSelfServiceInvalidInput = &SelfServiceError{Code: "selfservice_invalid_input", Message: "self-service: invalid input"}
    ErrSelfServiceConflict     = &SelfServiceError{Code: "selfservice_conflict", Message: "self-service: conflict"}
    ErrSelfServiceUnauthorized = &SelfServiceError{Code: "selfservice_unauthorized", Message: "self-service: unauthorized"}
    ErrSelfServiceInternal     = &SelfServiceError{Code: "selfservice_internal", Message: "self-service: internal error"}
)

func NewSelfServiceError(code, msg string) error { return &SelfServiceError{Code: code, Message: msg} }
func IsSelfServiceNotFound(err error) bool { return errors.Is(err, ErrSelfServiceNotFound) }
