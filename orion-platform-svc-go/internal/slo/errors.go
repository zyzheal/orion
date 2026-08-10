package slo

import "errors"

type SloError struct { Code string; Message string; Cause error }

func (e *SloError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *SloError) Is(target error) bool { _, ok := target.(*SloError); return ok }
func (e *SloError) Unwrap() error { return e.Cause }

var (
    ErrSloNotFound     = &SloError{Code: "slo_not_found", Message: "slo: not found"}
    ErrSloInvalidInput = &SloError{Code: "slo_invalid_input", Message: "slo: invalid input"}
    ErrSloConflict     = &SloError{Code: "slo_conflict", Message: "slo: conflict"}
    ErrSloUnauthorized = &SloError{Code: "slo_unauthorized", Message: "slo: unauthorized"}
    ErrSloInternal     = &SloError{Code: "slo_internal", Message: "slo: internal error"}
)

func NewSloError(code, msg string) error { return &SloError{Code: code, Message: msg} }
func IsSloNotFound(err error) bool { return errors.Is(err, ErrSloNotFound) }
