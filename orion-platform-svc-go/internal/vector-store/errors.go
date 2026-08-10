package vectorstore

import "errors"

type VectorStoreError struct { Code string; Message string; Cause error }

func (e *VectorStoreError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *VectorStoreError) Is(target error) bool { _, ok := target.(*VectorStoreError); return ok }
func (e *VectorStoreError) Unwrap() error { return e.Cause }

var (
    ErrVectorStoreNotFound     = &VectorStoreError{Code: "vectorstore_not_found", Message: "vector-store: not found"}
    ErrVectorStoreInvalidInput = &VectorStoreError{Code: "vectorstore_invalid_input", Message: "vector-store: invalid input"}
    ErrVectorStoreConflict     = &VectorStoreError{Code: "vectorstore_conflict", Message: "vector-store: conflict"}
    ErrVectorStoreUnauthorized = &VectorStoreError{Code: "vectorstore_unauthorized", Message: "vector-store: unauthorized"}
    ErrVectorStoreInternal     = &VectorStoreError{Code: "vectorstore_internal", Message: "vector-store: internal error"}
)

func NewVectorStoreError(code, msg string) error { return &VectorStoreError{Code: code, Message: msg} }
func IsVectorStoreNotFound(err error) bool { return errors.Is(err, ErrVectorStoreNotFound) }
