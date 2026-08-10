package ueba

import "errors"

type UebaError struct { Code string; Message string; Cause error }

func (e *UebaError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *UebaError) Is(target error) bool { _, ok := target.(*UebaError); return ok }
func (e *UebaError) Unwrap() error { return e.Cause }

var (
    ErrUebaNotFound     = &UebaError{Code: "ueba_not_found", Message: "ueba: not found"}
    ErrUebaInvalidInput = &UebaError{Code: "ueba_invalid_input", Message: "ueba: invalid input"}
    ErrUebaConflict     = &UebaError{Code: "ueba_conflict", Message: "ueba: conflict"}
    ErrUebaUnauthorized = &UebaError{Code: "ueba_unauthorized", Message: "ueba: unauthorized"}
    ErrUebaInternal     = &UebaError{Code: "ueba_internal", Message: "ueba: internal error"}
)

func NewUebaError(code, msg string) error { return &UebaError{Code: code, Message: msg} }
func IsUebaNotFound(err error) bool { return errors.Is(err, ErrUebaNotFound) }
