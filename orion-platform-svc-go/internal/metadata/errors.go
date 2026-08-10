package metadata

import "errors"

type MetadataError struct { Code string; Message string; Cause error }

func (e *MetadataError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *MetadataError) Is(target error) bool { _, ok := target.(*MetadataError); return ok }
func (e *MetadataError) Unwrap() error { return e.Cause }

var (
    ErrMetadataNotFound     = &MetadataError{Code: "metadata_not_found", Message: "metadata: not found"}
    ErrMetadataInvalidInput = &MetadataError{Code: "metadata_invalid_input", Message: "metadata: invalid input"}
    ErrMetadataConflict     = &MetadataError{Code: "metadata_conflict", Message: "metadata: conflict"}
    ErrMetadataUnauthorized = &MetadataError{Code: "metadata_unauthorized", Message: "metadata: unauthorized"}
    ErrMetadataInternal     = &MetadataError{Code: "metadata_internal", Message: "metadata: internal error"}
)

func NewMetadataError(code, msg string) error { return &MetadataError{Code: code, Message: msg} }
func IsMetadataNotFound(err error) bool { return errors.Is(err, ErrMetadataNotFound) }
