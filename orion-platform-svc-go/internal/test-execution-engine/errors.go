package testexecutionengine

import "errors"

type TestExecutionEngineError struct { Code string; Message string; Cause error }

func (e *TestExecutionEngineError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *TestExecutionEngineError) Is(target error) bool { _, ok := target.(*TestExecutionEngineError); return ok }
func (e *TestExecutionEngineError) Unwrap() error { return e.Cause }

var (
    ErrTestExecutionEngineNotFound     = &TestExecutionEngineError{Code: "testexecutionengine_not_found", Message: "test-execution-engine: not found"}
    ErrTestExecutionEngineInvalidInput = &TestExecutionEngineError{Code: "testexecutionengine_invalid_input", Message: "test-execution-engine: invalid input"}
    ErrTestExecutionEngineConflict     = &TestExecutionEngineError{Code: "testexecutionengine_conflict", Message: "test-execution-engine: conflict"}
    ErrTestExecutionEngineUnauthorized = &TestExecutionEngineError{Code: "testexecutionengine_unauthorized", Message: "test-execution-engine: unauthorized"}
    ErrTestExecutionEngineInternal     = &TestExecutionEngineError{Code: "testexecutionengine_internal", Message: "test-execution-engine: internal error"}
)

func NewTestExecutionEngineError(code, msg string) error { return &TestExecutionEngineError{Code: code, Message: msg} }
func IsTestExecutionEngineNotFound(err error) bool { return errors.Is(err, ErrTestExecutionEngineNotFound) }
