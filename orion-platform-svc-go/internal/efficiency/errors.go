package efficiency

import "errors"

// EfficiencyError represents domain errors for the efficiency module.
type EfficiencyError struct {
    Code    string
    Message string
    Cause   error
}

func (e *EfficiencyError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *EfficiencyError) Is(target error) bool {
    _, ok := target.(*EfficiencyError)
    return ok
}

func (e *EfficiencyError) Unwrap() error {
    return e.Cause
}

var (
    ErrEfficiencyNotFound     = &EfficiencyError{Code: "efficiency_not_found", Message: "efficiency: resource not found"}
    ErrEfficiencyInvalidInput = &EfficiencyError{Code: "efficiency_invalid_input", Message: "efficiency: invalid input"}
    ErrEfficiencyConflict     = &EfficiencyError{Code: "efficiency_conflict", Message: "efficiency: resource conflict"}
    ErrEfficiencyUnauthorized = &EfficiencyError{Code: "efficiency_unauthorized", Message: "efficiency: unauthorized access"}
    ErrEfficiencyInternal     = &EfficiencyError{Code: "efficiency_internal", Message: "efficiency: internal error"}
)

func NewEfficiencyError(code, message string) error {
    return &EfficiencyError{Code: code, Message: message}
}

func IsEfficiencyNotFound(err error) bool {
    return errors.Is(err, ErrEfficiencyNotFound)
}
