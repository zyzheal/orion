package vectorizerules

import "errors"

type VectorizeRulesError struct { Code string; Message string; Cause error }

func (e *VectorizeRulesError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *VectorizeRulesError) Is(target error) bool { _, ok := target.(*VectorizeRulesError); return ok }
func (e *VectorizeRulesError) Unwrap() error { return e.Cause }

var (
    ErrVectorizeRulesNotFound     = &VectorizeRulesError{Code: "vectorizerules_not_found", Message: "vectorize-rules: not found"}
    ErrVectorizeRulesInvalidInput = &VectorizeRulesError{Code: "vectorizerules_invalid_input", Message: "vectorize-rules: invalid input"}
    ErrVectorizeRulesConflict     = &VectorizeRulesError{Code: "vectorizerules_conflict", Message: "vectorize-rules: conflict"}
    ErrVectorizeRulesUnauthorized = &VectorizeRulesError{Code: "vectorizerules_unauthorized", Message: "vectorize-rules: unauthorized"}
    ErrVectorizeRulesInternal     = &VectorizeRulesError{Code: "vectorizerules_internal", Message: "vectorize-rules: internal error"}
)

func NewVectorizeRulesError(code, msg string) error { return &VectorizeRulesError{Code: code, Message: msg} }
func IsVectorizeRulesNotFound(err error) bool { return errors.Is(err, ErrVectorizeRulesNotFound) }
