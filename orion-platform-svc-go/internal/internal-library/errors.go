package internallibrary

import "errors"

// InternalLibraryError represents domain errors for the internal-library module.
type InternalLibraryError struct {
    Code    string
    Message string
    Cause   error
}

func (e *InternalLibraryError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *InternalLibraryError) Is(target error) bool {
    _, ok := target.(*InternalLibraryError)
    return ok
}

func (e *InternalLibraryError) Unwrap() error {
    return e.Cause
}

var (
    ErrInternalLibraryNotFound     = &InternalLibraryError{Code: "internallibrary_not_found", Message: "internal-library: resource not found"}
    ErrInternalLibraryInvalidInput = &InternalLibraryError{Code: "internallibrary_invalid_input", Message: "internal-library: invalid input"}
    ErrInternalLibraryConflict     = &InternalLibraryError{Code: "internallibrary_conflict", Message: "internal-library: resource conflict"}
    ErrInternalLibraryUnauthorized = &InternalLibraryError{Code: "internallibrary_unauthorized", Message: "internal-library: unauthorized access"}
    ErrInternalLibraryInternal     = &InternalLibraryError{Code: "internallibrary_internal", Message: "internal-library: internal error"}
)

func NewInternalLibraryError(code, message string) error {
    return &InternalLibraryError{Code: code, Message: message}
}

func IsInternalLibraryNotFound(err error) bool {
    return errors.Is(err, ErrInternalLibraryNotFound)
}
