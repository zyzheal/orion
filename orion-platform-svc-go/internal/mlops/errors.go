package mlops

import "errors"

type MlopsError struct { Code string; Message string; Cause error }

func (e *MlopsError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *MlopsError) Is(target error) bool { _, ok := target.(*MlopsError); return ok }
func (e *MlopsError) Unwrap() error { return e.Cause }

var (
    ErrMlopsNotFound     = &MlopsError{Code: "mlops_not_found", Message: "mlops: not found"}
    ErrMlopsInvalidInput = &MlopsError{Code: "mlops_invalid_input", Message: "mlops: invalid input"}
    ErrMlopsConflict     = &MlopsError{Code: "mlops_conflict", Message: "mlops: conflict"}
    ErrMlopsUnauthorized = &MlopsError{Code: "mlops_unauthorized", Message: "mlops: unauthorized"}
    ErrMlopsInternal     = &MlopsError{Code: "mlops_internal", Message: "mlops: internal error"}
)

func NewMlopsError(code, msg string) error { return &MlopsError{Code: code, Message: msg} }
func IsMlopsNotFound(err error) bool { return errors.Is(err, ErrMlopsNotFound) }
