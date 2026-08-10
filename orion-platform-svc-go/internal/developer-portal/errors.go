package developerportal

import "errors"

// DeveloperPortalError represents domain errors for the developer-portal module.
type DeveloperPortalError struct {
    Code    string
    Message string
    Cause   error
}

func (e *DeveloperPortalError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *DeveloperPortalError) Is(target error) bool {
    _, ok := target.(*DeveloperPortalError)
    return ok
}

func (e *DeveloperPortalError) Unwrap() error {
    return e.Cause
}

var (
    ErrDeveloperPortalNotFound     = &DeveloperPortalError{Code: "developerportal_not_found", Message: "developer-portal: resource not found"}
    ErrDeveloperPortalInvalidInput = &DeveloperPortalError{Code: "developerportal_invalid_input", Message: "developer-portal: invalid input"}
    ErrDeveloperPortalConflict     = &DeveloperPortalError{Code: "developerportal_conflict", Message: "developer-portal: resource conflict"}
    ErrDeveloperPortalUnauthorized = &DeveloperPortalError{Code: "developerportal_unauthorized", Message: "developer-portal: unauthorized access"}
    ErrDeveloperPortalInternal     = &DeveloperPortalError{Code: "developerportal_internal", Message: "developer-portal: internal error"}
)

func NewDeveloperPortalError(code, message string) error {
    return &DeveloperPortalError{Code: code, Message: message}
}

func IsDeveloperPortalNotFound(err error) bool {
    return errors.Is(err, ErrDeveloperPortalNotFound)
}
