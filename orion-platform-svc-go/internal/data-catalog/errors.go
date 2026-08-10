package datacatalog

import "errors"

// DataCatalogError represents domain errors for the data-catalog module.
type DataCatalogError struct {
    Code    string
    Message string
    Cause   error
}

func (e *DataCatalogError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *DataCatalogError) Is(target error) bool {
    _, ok := target.(*DataCatalogError)
    return ok
}

func (e *DataCatalogError) Unwrap() error {
    return e.Cause
}

var (
    ErrDataCatalogNotFound     = &DataCatalogError{Code: "datacatalog_not_found", Message: "data-catalog: resource not found"}
    ErrDataCatalogInvalidInput = &DataCatalogError{Code: "datacatalog_invalid_input", Message: "data-catalog: invalid input"}
    ErrDataCatalogConflict     = &DataCatalogError{Code: "datacatalog_conflict", Message: "data-catalog: resource conflict"}
    ErrDataCatalogUnauthorized = &DataCatalogError{Code: "datacatalog_unauthorized", Message: "data-catalog: unauthorized access"}
    ErrDataCatalogInternal     = &DataCatalogError{Code: "datacatalog_internal", Message: "data-catalog: internal error"}
)

func NewDataCatalogError(code, message string) error {
    return &DataCatalogError{Code: code, Message: message}
}

func IsDataCatalogNotFound(err error) bool {
    return errors.Is(err, ErrDataCatalogNotFound)
}
