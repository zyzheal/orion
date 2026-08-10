package chaosenhanced

import "errors"

type ChaosEnhancedError struct { Code string; Message string; Cause error }

func (e *ChaosEnhancedError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ChaosEnhancedError) Is(target error) bool { _, ok := target.(*ChaosEnhancedError); return ok }
func (e *ChaosEnhancedError) Unwrap() error { return e.Cause }

var (
    ErrChaosEnhancedNotFound     = &ChaosEnhancedError{Code: "chaosenhanced_not_found", Message: "chaos-enhanced: not found"}
    ErrChaosEnhancedInvalidInput = &ChaosEnhancedError{Code: "chaosenhanced_invalid_input", Message: "chaos-enhanced: invalid input"}
    ErrChaosEnhancedConflict     = &ChaosEnhancedError{Code: "chaosenhanced_conflict", Message: "chaos-enhanced: conflict"}
    ErrChaosEnhancedUnauthorized = &ChaosEnhancedError{Code: "chaosenhanced_unauthorized", Message: "chaos-enhanced: unauthorized"}
    ErrChaosEnhancedInternal     = &ChaosEnhancedError{Code: "chaosenhanced_internal", Message: "chaos-enhanced: internal error"}
)

func NewChaosEnhancedError(code, msg string) error { return &ChaosEnhancedError{Code: code, Message: msg} }
func IsChaosEnhancedNotFound(err error) bool { return errors.Is(err, ErrChaosEnhancedNotFound) }
