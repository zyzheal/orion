package vector

import "errors"

type VectorError struct { Code string; Message string; Cause error }

func (e *VectorError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *VectorError) Is(target error) bool { _, ok := target.(*VectorError); return ok }
func (e *VectorError) Unwrap() error { return e.Cause }

var (
    ErrVectorNotFound     = &VectorError{Code: "vector_not_found", Message: "vector: not found"}
    ErrVectorInvalidInput = &VectorError{Code: "vector_invalid_input", Message: "vector: invalid input"}
    ErrVectorConflict     = &VectorError{Code: "vector_conflict", Message: "vector: conflict"}
    ErrVectorUnauthorized = &VectorError{Code: "vector_unauthorized", Message: "vector: unauthorized"}
    ErrVectorInternal     = &VectorError{Code: "vector_internal", Message: "vector: internal error"}
)

func NewVectorError(code, msg string) error { return &VectorError{Code: code, Message: msg} }
func IsVectorNotFound(err error) bool { return errors.Is(err, ErrVectorNotFound) }
