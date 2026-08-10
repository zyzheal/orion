package storage

import "errors"

type StorageError struct { Code string; Message string; Cause error }

func (e *StorageError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *StorageError) Is(target error) bool { _, ok := target.(*StorageError); return ok }
func (e *StorageError) Unwrap() error { return e.Cause }

var (
    ErrStorageNotFound     = &StorageError{Code: "storage_not_found", Message: "storage: not found"}
    ErrStorageInvalidInput = &StorageError{Code: "storage_invalid_input", Message: "storage: invalid input"}
    ErrStorageConflict     = &StorageError{Code: "storage_conflict", Message: "storage: conflict"}
    ErrStorageUnauthorized = &StorageError{Code: "storage_unauthorized", Message: "storage: unauthorized"}
    ErrStorageInternal     = &StorageError{Code: "storage_internal", Message: "storage: internal error"}
)

func NewStorageError(code, msg string) error { return &StorageError{Code: code, Message: msg} }
func IsStorageNotFound(err error) bool { return errors.Is(err, ErrStorageNotFound) }
