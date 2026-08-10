package citype

import "errors"

// CiTypeError represents domain errors for the ci-type module.
type CiTypeError struct {
    Code    string
    Message string
    Cause   error
}

func (e *CiTypeError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *CiTypeError) Is(target error) bool {
    _, ok := target.(*CiTypeError)
    return ok
}

func (e *CiTypeError) Unwrap() error {
    return e.Cause
}

var (
    ErrCiTypeNotFound     = &CiTypeError{Code: "citype_not_found", Message: "ci-type: resource not found"}
    ErrCiTypeInvalidInput = &CiTypeError{Code: "citype_invalid_input", Message: "ci-type: invalid input"}
    ErrCiTypeConflict     = &CiTypeError{Code: "citype_conflict", Message: "ci-type: resource conflict"}
    ErrCiTypeUnauthorized = &CiTypeError{Code: "citype_unauthorized", Message: "ci-type: unauthorized access"}
    ErrCiTypeInternal     = &CiTypeError{Code: "citype_internal", Message: "ci-type: internal error"}
)

func NewCiTypeError(code, message string) error {
    return &CiTypeError{Code: code, Message: message}
}

func IsCiTypeNotFound(err error) bool {
    return errors.Is(err, ErrCiTypeNotFound)
}
