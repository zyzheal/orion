package testgeneration

import "errors"

type TestGenerationError struct { Code string; Message string; Cause error }

func (e *TestGenerationError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *TestGenerationError) Is(target error) bool { _, ok := target.(*TestGenerationError); return ok }
func (e *TestGenerationError) Unwrap() error { return e.Cause }

var (
    ErrTestGenerationNotFound     = &TestGenerationError{Code: "testgeneration_not_found", Message: "test-generation: not found"}
    ErrTestGenerationInvalidInput = &TestGenerationError{Code: "testgeneration_invalid_input", Message: "test-generation: invalid input"}
    ErrTestGenerationConflict     = &TestGenerationError{Code: "testgeneration_conflict", Message: "test-generation: conflict"}
    ErrTestGenerationUnauthorized = &TestGenerationError{Code: "testgeneration_unauthorized", Message: "test-generation: unauthorized"}
    ErrTestGenerationInternal     = &TestGenerationError{Code: "testgeneration_internal", Message: "test-generation: internal error"}
)

func NewTestGenerationError(code, msg string) error { return &TestGenerationError{Code: code, Message: msg} }
func IsTestGenerationNotFound(err error) bool { return errors.Is(err, ErrTestGenerationNotFound) }
