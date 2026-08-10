package datalineage

import "errors"

type DataLineageError struct { Code string; Message string; Cause error }

func (e *DataLineageError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *DataLineageError) Is(target error) bool { _, ok := target.(*DataLineageError); return ok }
func (e *DataLineageError) Unwrap() error { return e.Cause }

var (
    ErrDataLineageNotFound     = &DataLineageError{Code: "datalineage_not_found", Message: "data-lineage: not found"}
    ErrDataLineageInvalidInput = &DataLineageError{Code: "datalineage_invalid_input", Message: "data-lineage: invalid input"}
    ErrDataLineageConflict     = &DataLineageError{Code: "datalineage_conflict", Message: "data-lineage: conflict"}
    ErrDataLineageUnauthorized = &DataLineageError{Code: "datalineage_unauthorized", Message: "data-lineage: unauthorized"}
    ErrDataLineageInternal     = &DataLineageError{Code: "datalineage_internal", Message: "data-lineage: internal error"}
)

func NewDataLineageError(code, msg string) error { return &DataLineageError{Code: code, Message: msg} }
func IsDataLineageNotFound(err error) bool { return errors.Is(err, ErrDataLineageNotFound) }
