package handler

import "errors"

type RcaError struct { Code string; Message string; Cause error }

func (e *RcaError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *RcaError) Is(target error) bool { _, ok := target.(*RcaError); return ok }
func (e *RcaError) Unwrap() error { return e.Cause }

var (
    ErrRcaNotFound     = &RcaError{Code: "rca_not_found", Message: "rca: not found"}
    ErrRcaInvalidInput = &RcaError{Code: "rca_invalid_input", Message: "rca: invalid input"}
    ErrRcaConflict     = &RcaError{Code: "rca_conflict", Message: "rca: conflict"}
    ErrRcaUnauthorized = &RcaError{Code: "rca_unauthorized", Message: "rca: unauthorized"}
    ErrRcaInternal     = &RcaError{Code: "rca_internal", Message: "rca: internal error"}
)

func NewRcaError(code, msg string) error { return &RcaError{Code: code, Message: msg} }
func IsRcaNotFound(err error) bool { return errors.Is(err, ErrRcaNotFound) }
