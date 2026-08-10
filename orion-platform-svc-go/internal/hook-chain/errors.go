package hookchain

import "errors"

type HookChainError struct { Code string; Message string; Cause error }

func (e *HookChainError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *HookChainError) Is(target error) bool { _, ok := target.(*HookChainError); return ok }
func (e *HookChainError) Unwrap() error { return e.Cause }

var (
    ErrHookChainNotFound     = &HookChainError{Code: "hookchain_not_found", Message: "hook-chain: not found"}
    ErrHookChainInvalidInput = &HookChainError{Code: "hookchain_invalid_input", Message: "hook-chain: invalid input"}
    ErrHookChainConflict     = &HookChainError{Code: "hookchain_conflict", Message: "hook-chain: conflict"}
    ErrHookChainUnauthorized = &HookChainError{Code: "hookchain_unauthorized", Message: "hook-chain: unauthorized"}
    ErrHookChainInternal     = &HookChainError{Code: "hookchain_internal", Message: "hook-chain: internal error"}
)

func NewHookChainError(code, msg string) error { return &HookChainError{Code: code, Message: msg} }
func IsHookChainNotFound(err error) bool { return errors.Is(err, ErrHookChainNotFound) }
