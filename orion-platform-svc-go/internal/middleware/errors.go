package middleware

import "errors"

type MiddlewareError struct { Code string; Message string; Cause error }

func (e *MiddlewareError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *MiddlewareError) Is(target error) bool { _, ok := target.(*MiddlewareError); return ok }
func (e *MiddlewareError) Unwrap() error { return e.Cause }

var (
    ErrMiddlewareNotFound     = &MiddlewareError{Code: "middleware_not_found", Message: "middleware: not found"}
    ErrMiddlewareInvalidInput = &MiddlewareError{Code: "middleware_invalid_input", Message: "middleware: invalid input"}
    ErrMiddlewareConflict     = &MiddlewareError{Code: "middleware_conflict", Message: "middleware: conflict"}
    ErrMiddlewareUnauthorized = &MiddlewareError{Code: "middleware_unauthorized", Message: "middleware: unauthorized"}
    ErrMiddlewareInternal     = &MiddlewareError{Code: "middleware_internal", Message: "middleware: internal error"}
)

func NewMiddlewareError(code, msg string) error { return &MiddlewareError{Code: code, Message: msg} }
func IsMiddlewareNotFound(err error) bool { return errors.Is(err, ErrMiddlewareNotFound) }
