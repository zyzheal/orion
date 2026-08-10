package multicloud

import "errors"

// MultiCloudError represents domain errors for the multi-cloud module.
type MultiCloudError struct {
    Code    string
    Message string
    Cause   error
}

func (e *MultiCloudError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *MultiCloudError) Is(target error) bool {
    _, ok := target.(*MultiCloudError)
    return ok
}

func (e *MultiCloudError) Unwrap() error {
    return e.Cause
}

var (
    ErrMultiCloudNotFound     = &MultiCloudError{Code: "multicloud_not_found", Message: "multi-cloud: resource not found"}
    ErrMultiCloudInvalidInput = &MultiCloudError{Code: "multicloud_invalid_input", Message: "multi-cloud: invalid input"}
    ErrMultiCloudConflict     = &MultiCloudError{Code: "multicloud_conflict", Message: "multi-cloud: resource conflict"}
    ErrMultiCloudUnauthorized = &MultiCloudError{Code: "multicloud_unauthorized", Message: "multi-cloud: unauthorized access"}
    ErrMultiCloudInternal     = &MultiCloudError{Code: "multicloud_internal", Message: "multi-cloud: internal error"}
)

func NewMultiCloudError(code, message string) error {
    return &MultiCloudError{Code: code, Message: message}
}

func IsMultiCloudNotFound(err error) bool {
    return errors.Is(err, ErrMultiCloudNotFound)
}
