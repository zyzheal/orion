package sandbox

import "errors"

type SandboxError struct { Code string; Message string; Cause error }

func (e *SandboxError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *SandboxError) Is(target error) bool { _, ok := target.(*SandboxError); return ok }
func (e *SandboxError) Unwrap() error { return e.Cause }

var (
    ErrSandboxNotFound     = &SandboxError{Code: "sandbox_not_found", Message: "sandbox: not found"}
    ErrSandboxInvalidInput = &SandboxError{Code: "sandbox_invalid_input", Message: "sandbox: invalid input"}
    ErrSandboxConflict     = &SandboxError{Code: "sandbox_conflict", Message: "sandbox: conflict"}
    ErrSandboxUnauthorized = &SandboxError{Code: "sandbox_unauthorized", Message: "sandbox: unauthorized"}
    ErrSandboxInternal     = &SandboxError{Code: "sandbox_internal", Message: "sandbox: internal error"}
)

func NewSandboxError(code, msg string) error { return &SandboxError{Code: code, Message: msg} }
func IsSandboxNotFound(err error) bool { return errors.Is(err, ErrSandboxNotFound) }
