package canaryanalysis

import "errors"

type CanaryAnalysisError struct { Code string; Message string; Cause error }

func (e *CanaryAnalysisError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *CanaryAnalysisError) Is(target error) bool { _, ok := target.(*CanaryAnalysisError); return ok }
func (e *CanaryAnalysisError) Unwrap() error { return e.Cause }

var (
    ErrCanaryAnalysisNotFound     = &CanaryAnalysisError{Code: "canaryanalysis_not_found", Message: "canary-analysis: not found"}
    ErrCanaryAnalysisInvalidInput = &CanaryAnalysisError{Code: "canaryanalysis_invalid_input", Message: "canary-analysis: invalid input"}
    ErrCanaryAnalysisConflict     = &CanaryAnalysisError{Code: "canaryanalysis_conflict", Message: "canary-analysis: conflict"}
    ErrCanaryAnalysisUnauthorized = &CanaryAnalysisError{Code: "canaryanalysis_unauthorized", Message: "canary-analysis: unauthorized"}
    ErrCanaryAnalysisInternal     = &CanaryAnalysisError{Code: "canaryanalysis_internal", Message: "canary-analysis: internal error"}
)

func NewCanaryAnalysisError(code, msg string) error { return &CanaryAnalysisError{Code: code, Message: msg} }
func IsCanaryAnalysisNotFound(err error) bool { return errors.Is(err, ErrCanaryAnalysisNotFound) }
