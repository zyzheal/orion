package featureflag

import "errors"

// FeatureFlagError represents domain errors for the feature-flag module.
type FeatureFlagError struct {
    Code    string
    Message string
    Cause   error
}

func (e *FeatureFlagError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *FeatureFlagError) Is(target error) bool {
    _, ok := target.(*FeatureFlagError)
    return ok
}

func (e *FeatureFlagError) Unwrap() error {
    return e.Cause
}

var (
    ErrFeatureFlagNotFound     = &FeatureFlagError{Code: "featureflag_not_found", Message: "feature-flag: resource not found"}
    ErrFeatureFlagInvalidInput = &FeatureFlagError{Code: "featureflag_invalid_input", Message: "feature-flag: invalid input"}
    ErrFeatureFlagConflict     = &FeatureFlagError{Code: "featureflag_conflict", Message: "feature-flag: resource conflict"}
    ErrFeatureFlagUnauthorized = &FeatureFlagError{Code: "featureflag_unauthorized", Message: "feature-flag: unauthorized access"}
    ErrFeatureFlagInternal     = &FeatureFlagError{Code: "featureflag_internal", Message: "feature-flag: internal error"}
)

func NewFeatureFlagError(code, message string) error {
    return &FeatureFlagError{Code: code, Message: message}
}

func IsFeatureFlagNotFound(err error) bool {
    return errors.Is(err, ErrFeatureFlagNotFound)
}
