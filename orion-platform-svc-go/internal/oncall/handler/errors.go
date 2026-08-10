package handler

import "errors"

type OncallError struct { Code string; Message string; Cause error }

func (e *OncallError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *OncallError) Is(target error) bool { _, ok := target.(*OncallError); return ok }
func (e *OncallError) Unwrap() error { return e.Cause }

var (
    ErrOncallNotFound     = &OncallError{Code: "oncall_not_found", Message: "oncall: not found"}
    ErrOncallInvalidInput = &OncallError{Code: "oncall_invalid_input", Message: "oncall: invalid input"}
    ErrOncallConflict     = &OncallError{Code: "oncall_conflict", Message: "oncall: conflict"}
    ErrOncallUnauthorized = &OncallError{Code: "oncall_unauthorized", Message: "oncall: unauthorized"}
    ErrOncallInternal     = &OncallError{Code: "oncall_internal", Message: "oncall: internal error"}
)

func NewOncallError(code, msg string) error { return &OncallError{Code: code, Message: msg} }
func IsOncallNotFound(err error) bool { return errors.Is(err, ErrOncallNotFound) }
