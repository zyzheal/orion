package unifiedconfig

import "errors"

type UnifiedConfigError struct { Code string; Message string; Cause error }

func (e *UnifiedConfigError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *UnifiedConfigError) Is(target error) bool { _, ok := target.(*UnifiedConfigError); return ok }
func (e *UnifiedConfigError) Unwrap() error { return e.Cause }

var (
    ErrUnifiedConfigNotFound     = &UnifiedConfigError{Code: "unifiedconfig_not_found", Message: "unified-config: not found"}
    ErrUnifiedConfigInvalidInput = &UnifiedConfigError{Code: "unifiedconfig_invalid_input", Message: "unified-config: invalid input"}
    ErrUnifiedConfigConflict     = &UnifiedConfigError{Code: "unifiedconfig_conflict", Message: "unified-config: conflict"}
    ErrUnifiedConfigUnauthorized = &UnifiedConfigError{Code: "unifiedconfig_unauthorized", Message: "unified-config: unauthorized"}
    ErrUnifiedConfigInternal     = &UnifiedConfigError{Code: "unifiedconfig_internal", Message: "unified-config: internal error"}
)

func NewUnifiedConfigError(code, msg string) error { return &UnifiedConfigError{Code: code, Message: msg} }
func IsUnifiedConfigNotFound(err error) bool { return errors.Is(err, ErrUnifiedConfigNotFound) }
