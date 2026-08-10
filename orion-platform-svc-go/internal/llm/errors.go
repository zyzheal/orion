package llm

import "errors"

type LlmError struct { Code string; Message string; Cause error }

func (e *LlmError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *LlmError) Is(target error) bool { _, ok := target.(*LlmError); return ok }
func (e *LlmError) Unwrap() error { return e.Cause }

var (
    ErrLlmNotFound     = &LlmError{Code: "llm_not_found", Message: "llm: not found"}
    ErrLlmInvalidInput = &LlmError{Code: "llm_invalid_input", Message: "llm: invalid input"}
    ErrLlmConflict     = &LlmError{Code: "llm_conflict", Message: "llm: conflict"}
    ErrLlmUnauthorized = &LlmError{Code: "llm_unauthorized", Message: "llm: unauthorized"}
    ErrLlmInternal     = &LlmError{Code: "llm_internal", Message: "llm: internal error"}
)

func NewLlmError(code, msg string) error { return &LlmError{Code: code, Message: msg} }
func IsLlmNotFound(err error) bool { return errors.Is(err, ErrLlmNotFound) }
