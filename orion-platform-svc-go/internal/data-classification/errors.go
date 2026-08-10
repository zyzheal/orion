package dataclassification

import "errors"

type DataClassificationError struct { Code string; Message string; Cause error }

func (e *DataClassificationError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *DataClassificationError) Is(target error) bool { _, ok := target.(*DataClassificationError); return ok }
func (e *DataClassificationError) Unwrap() error { return e.Cause }

var (
    ErrDataClassificationNotFound     = &DataClassificationError{Code: "dataclassification_not_found", Message: "data-classification: not found"}
    ErrDataClassificationInvalidInput = &DataClassificationError{Code: "dataclassification_invalid_input", Message: "data-classification: invalid input"}
    ErrDataClassificationConflict     = &DataClassificationError{Code: "dataclassification_conflict", Message: "data-classification: conflict"}
    ErrDataClassificationUnauthorized = &DataClassificationError{Code: "dataclassification_unauthorized", Message: "data-classification: unauthorized"}
    ErrDataClassificationInternal     = &DataClassificationError{Code: "dataclassification_internal", Message: "data-classification: internal error"}
)

func NewDataClassificationError(code, msg string) error { return &DataClassificationError{Code: code, Message: msg} }
func IsDataClassificationNotFound(err error) bool { return errors.Is(err, ErrDataClassificationNotFound) }
