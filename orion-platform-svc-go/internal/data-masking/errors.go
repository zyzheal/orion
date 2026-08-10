package datamasking

import "errors"

type DataMaskingError struct { Code string; Message string; Cause error }

func (e *DataMaskingError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *DataMaskingError) Is(target error) bool { _, ok := target.(*DataMaskingError); return ok }
func (e *DataMaskingError) Unwrap() error { return e.Cause }

var (
    ErrDataMaskingNotFound     = &DataMaskingError{Code: "data_masking_not_found", Message: "data-masking: not found"}
    ErrDataMaskingInvalidInput = &DataMaskingError{Code: "data_masking_invalid_input", Message: "data-masking: invalid input"}
    ErrDataMaskingConflict     = &DataMaskingError{Code: "data_masking_conflict", Message: "data-masking: conflict"}
    ErrDataMaskingUnauthorized = &DataMaskingError{Code: "data_masking_unauthorized", Message: "data-masking: unauthorized"}
    ErrDataMaskingInternal     = &DataMaskingError{Code: "data_masking_internal", Message: "data-masking: internal error"}
)

func NewDataMaskingError(code, msg string) error { return &DataMaskingError{Code: code, Message: msg} }
func IsDataMaskingNotFound(err error) bool { return errors.Is(err, ErrDataMaskingNotFound) }
