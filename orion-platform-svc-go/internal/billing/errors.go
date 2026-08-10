package billing

import "errors"

// BillingError represents domain errors for the billing module.
type BillingError struct {
    Code    string
    Message string
    Cause   error
}

func (e *BillingError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *BillingError) Is(target error) bool {
    _, ok := target.(*BillingError)
    return ok
}

func (e *BillingError) Unwrap() error {
    return e.Cause
}

var (
    ErrBillingNotFound     = &BillingError{Code: "billing_not_found", Message: "billing: resource not found"}
    ErrBillingInvalidInput = &BillingError{Code: "billing_invalid_input", Message: "billing: invalid input"}
    ErrBillingConflict     = &BillingError{Code: "billing_conflict", Message: "billing: resource conflict"}
    ErrBillingUnauthorized = &BillingError{Code: "billing_unauthorized", Message: "billing: unauthorized access"}
    ErrBillingInternal     = &BillingError{Code: "billing_internal", Message: "billing: internal error"}
)

func NewBillingError(code, message string) error {
    return &BillingError{Code: code, Message: message}
}

func IsBillingNotFound(err error) bool {
    return errors.Is(err, ErrBillingNotFound)
}
