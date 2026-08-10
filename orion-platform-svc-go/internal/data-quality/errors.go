package dataquality

import "errors"

// DataQualityError represents domain errors for the data-quality module.
type DataQualityError struct {
    Code    string
    Message string
    Cause   error
}

func (e *DataQualityError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *DataQualityError) Is(target error) bool {
    _, ok := target.(*DataQualityError)
    return ok
}

func (e *DataQualityError) Unwrap() error {
    return e.Cause
}

var (
    ErrDataQualityNotFound     = &DataQualityError{Code: "dataquality_not_found", Message: "data-quality: resource not found"}
    ErrDataQualityInvalidInput = &DataQualityError{Code: "dataquality_invalid_input", Message: "data-quality: invalid input"}
    ErrDataQualityConflict     = &DataQualityError{Code: "dataquality_conflict", Message: "data-quality: resource conflict"}
    ErrDataQualityUnauthorized = &DataQualityError{Code: "dataquality_unauthorized", Message: "data-quality: unauthorized access"}
    ErrDataQualityInternal     = &DataQualityError{Code: "dataquality_internal", Message: "data-quality: internal error"}
)

func NewDataQualityError(code, message string) error {
    return &DataQualityError{Code: code, Message: message}
}

func IsDataQualityNotFound(err error) bool {
    return errors.Is(err, ErrDataQualityNotFound)
}
