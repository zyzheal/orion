package visor

import "errors"

type VisorError struct { Code string; Message string; Cause error }

func (e *VisorError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *VisorError) Is(target error) bool { _, ok := target.(*VisorError); return ok }
func (e *VisorError) Unwrap() error { return e.Cause }

var (
    ErrVisorNotFound     = &VisorError{Code: "visor_not_found", Message: "visor: not found"}
    ErrVisorInvalidInput = &VisorError{Code: "visor_invalid_input", Message: "visor: invalid input"}
    ErrVisorConflict     = &VisorError{Code: "visor_conflict", Message: "visor: conflict"}
    ErrVisorUnauthorized = &VisorError{Code: "visor_unauthorized", Message: "visor: unauthorized"}
    ErrVisorInternal     = &VisorError{Code: "visor_internal", Message: "visor: internal error"}
)

func NewVisorError(code, msg string) error { return &VisorError{Code: code, Message: msg} }
func IsVisorNotFound(err error) bool { return errors.Is(err, ErrVisorNotFound) }
