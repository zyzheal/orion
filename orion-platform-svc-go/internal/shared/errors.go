package shared

import "errors"

// SharedError represents domain errors for the shared module.
type SharedError struct {
    Code    string
    Message string
    Cause   error
}

func (e *SharedError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *SharedError) Is(target error) bool {
    _, ok := target.(*SharedError)
    return ok
}

func (e *SharedError) Unwrap() error {
    return e.Cause
}

var (
    ErrSharedNotFound     = &SharedError{Code: "shared_not_found", Message: "shared: resource not found"}
    ErrSharedInvalidInput = &SharedError{Code: "shared_invalid_input", Message: "shared: invalid input"}
    ErrSharedConflict     = &SharedError{Code: "shared_conflict", Message: "shared: resource conflict"}
    ErrSharedUnauthorized = &SharedError{Code: "shared_unauthorized", Message: "shared: unauthorized access"}
    ErrSharedInternal     = &SharedError{Code: "shared_internal", Message: "shared: internal error"}
)

func NewSharedError(code, message string) error {
    return &SharedError{Code: code, Message: message}
}

func IsSharedNotFound(err error) bool {
    return errors.Is(err, ErrSharedNotFound)
}
