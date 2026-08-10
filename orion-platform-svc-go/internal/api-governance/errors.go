package apigovernance

import "errors"

// ApiGovernanceError represents domain errors for the api-governance module.
type ApiGovernanceError struct {
    Code    string
    Message string
    Cause   error
}

func (e *ApiGovernanceError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *ApiGovernanceError) Is(target error) bool {
    _, ok := target.(*ApiGovernanceError)
    return ok
}

func (e *ApiGovernanceError) Unwrap() error {
    return e.Cause
}

var (
    ErrApiGovernanceNotFound     = &ApiGovernanceError{Code: "apigovernance_not_found", Message: "api-governance: resource not found"}
    ErrApiGovernanceInvalidInput = &ApiGovernanceError{Code: "apigovernance_invalid_input", Message: "api-governance: invalid input"}
    ErrApiGovernanceConflict     = &ApiGovernanceError{Code: "apigovernance_conflict", Message: "api-governance: resource conflict"}
    ErrApiGovernanceUnauthorized = &ApiGovernanceError{Code: "apigovernance_unauthorized", Message: "api-governance: unauthorized access"}
    ErrApiGovernanceInternal     = &ApiGovernanceError{Code: "apigovernance_internal", Message: "api-governance: internal error"}
)

func NewApiGovernanceError(code, message string) error {
    return &ApiGovernanceError{Code: code, Message: message}
}

func IsApiGovernanceNotFound(err error) bool {
    return errors.Is(err, ErrApiGovernanceNotFound)
}
