package change

import "errors"

// ChangeError represents domain errors for the change module.
type ChangeError struct {
    Code    string
    Message string
    Cause   error
}

func (e *ChangeError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *ChangeError) Is(target error) bool {
    _, ok := target.(*ChangeError)
    return ok
}

func (e *ChangeError) Unwrap() error {
    return e.Cause
}

var (
    ErrChangeNotFound     = &ChangeError{Code: "change_not_found", Message: "change: resource not found"}
    ErrChangeInvalidInput = &ChangeError{Code: "change_invalid_input", Message: "change: invalid input"}
    ErrChangeConflict     = &ChangeError{Code: "change_conflict", Message: "change: resource conflict"}
    ErrChangeUnauthorized = &ChangeError{Code: "change_unauthorized", Message: "change: unauthorized access"}
    ErrChangeInternal     = &ChangeError{Code: "change_internal", Message: "change: internal error"}
)

func NewChangeError(code, message string) error {
    return &ChangeError{Code: code, Message: message}
}

func IsChangeNotFound(err error) bool {
    return errors.Is(err, ErrChangeNotFound)
}
