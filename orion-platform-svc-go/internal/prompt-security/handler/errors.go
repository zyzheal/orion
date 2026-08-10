package handler

import "errors"

type PromptSecurityError struct { Code string; Message string; Cause error }

func (e *PromptSecurityError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *PromptSecurityError) Is(target error) bool { _, ok := target.(*PromptSecurityError); return ok }
func (e *PromptSecurityError) Unwrap() error { return e.Cause }

var (
    ErrPromptSecurityNotFound     = &PromptSecurityError{Code: "promptsecurity_not_found", Message: "prompt-security: not found"}
    ErrPromptSecurityInvalidInput = &PromptSecurityError{Code: "promptsecurity_invalid_input", Message: "prompt-security: invalid input"}
    ErrPromptSecurityConflict     = &PromptSecurityError{Code: "promptsecurity_conflict", Message: "prompt-security: conflict"}
    ErrPromptSecurityUnauthorized = &PromptSecurityError{Code: "promptsecurity_unauthorized", Message: "prompt-security: unauthorized"}
    ErrPromptSecurityInternal     = &PromptSecurityError{Code: "promptsecurity_internal", Message: "prompt-security: internal error"}
)

func NewPromptSecurityError(code, msg string) error { return &PromptSecurityError{Code: code, Message: msg} }
func IsPromptSecurityNotFound(err error) bool { return errors.Is(err, ErrPromptSecurityNotFound) }
