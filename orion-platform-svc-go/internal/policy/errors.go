package policy

import "errors"

// PolicyError represents domain errors for the policy module.
type PolicyError struct {
    Code    string
    Message string
    Cause   error
}

func (e *PolicyError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *PolicyError) Is(target error) bool {
    _, ok := target.(*PolicyError)
    return ok
}

func (e *PolicyError) Unwrap() error {
    return e.Cause
}

var (
    ErrPolicyNotFound     = &PolicyError{Code: "policy_not_found", Message: "policy: resource not found"}
    ErrPolicyInvalidInput = &PolicyError{Code: "policy_invalid_input", Message: "policy: invalid input"}
    ErrPolicyConflict     = &PolicyError{Code: "policy_conflict", Message: "policy: resource conflict"}
    ErrPolicyUnauthorized = &PolicyError{Code: "policy_unauthorized", Message: "policy: unauthorized access"}
    ErrPolicyInternal     = &PolicyError{Code: "policy_internal", Message: "policy: internal error"}
)

func NewPolicyError(code, message string) error {
    return &PolicyError{Code: code, Message: message}
}

func IsPolicyNotFound(err error) bool {
    return errors.Is(err, ErrPolicyNotFound)
}
