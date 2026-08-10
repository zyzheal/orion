package resiliencescore

import "errors"

// ResilienceScoreError represents domain errors for the resilience-score module.
type ResilienceScoreError struct {
    Code    string
    Message string
    Cause   error
}

func (e *ResilienceScoreError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *ResilienceScoreError) Is(target error) bool {
    _, ok := target.(*ResilienceScoreError)
    return ok
}

func (e *ResilienceScoreError) Unwrap() error {
    return e.Cause
}

var (
    ErrResilienceScoreNotFound     = &ResilienceScoreError{Code: "resiliencescore_not_found", Message: "resilience-score: resource not found"}
    ErrResilienceScoreInvalidInput = &ResilienceScoreError{Code: "resiliencescore_invalid_input", Message: "resilience-score: invalid input"}
    ErrResilienceScoreConflict     = &ResilienceScoreError{Code: "resiliencescore_conflict", Message: "resilience-score: resource conflict"}
    ErrResilienceScoreUnauthorized = &ResilienceScoreError{Code: "resiliencescore_unauthorized", Message: "resilience-score: unauthorized access"}
    ErrResilienceScoreInternal     = &ResilienceScoreError{Code: "resiliencescore_internal", Message: "resilience-score: internal error"}
)

func NewResilienceScoreError(code, message string) error {
    return &ResilienceScoreError{Code: code, Message: message}
}

func IsResilienceScoreNotFound(err error) bool {
    return errors.Is(err, ErrResilienceScoreNotFound)
}
