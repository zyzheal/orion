package approval

import "errors"

// ApprovalError represents domain errors for the approval module.
type ApprovalError struct {
    Code    string
    Message string
    Cause   error
}

func (e *ApprovalError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *ApprovalError) Is(target error) bool {
    _, ok := target.(*ApprovalError)
    return ok
}

func (e *ApprovalError) Unwrap() error {
    return e.Cause
}

var (
    ErrApprovalNotFound     = &ApprovalError{Code: "approval_not_found", Message: "approval: resource not found"}
    ErrApprovalInvalidInput = &ApprovalError{Code: "approval_invalid_input", Message: "approval: invalid input"}
    ErrApprovalConflict     = &ApprovalError{Code: "approval_conflict", Message: "approval: resource conflict"}
    ErrApprovalUnauthorized = &ApprovalError{Code: "approval_unauthorized", Message: "approval: unauthorized access"}
    ErrApprovalInternal     = &ApprovalError{Code: "approval_internal", Message: "approval: internal error"}
)

func NewApprovalError(code, message string) error {
    return &ApprovalError{Code: code, Message: message}
}

func IsApprovalNotFound(err error) bool {
    return errors.Is(err, ErrApprovalNotFound)
}
