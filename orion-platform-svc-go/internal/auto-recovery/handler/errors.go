package handler

import "errors"

type AutoRecoveryError struct { Code string; Message string; Cause error }

func (e *AutoRecoveryError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *AutoRecoveryError) Is(target error) bool { _, ok := target.(*AutoRecoveryError); return ok }
func (e *AutoRecoveryError) Unwrap() error { return e.Cause }

var (
    ErrAutoRecoveryNotFound     = &AutoRecoveryError{Code: "autorecovery_not_found", Message: "auto-recovery: not found"}
    ErrAutoRecoveryInvalidInput = &AutoRecoveryError{Code: "autorecovery_invalid_input", Message: "auto-recovery: invalid input"}
    ErrAutoRecoveryConflict     = &AutoRecoveryError{Code: "autorecovery_conflict", Message: "auto-recovery: conflict"}
    ErrAutoRecoveryUnauthorized = &AutoRecoveryError{Code: "autorecovery_unauthorized", Message: "auto-recovery: unauthorized"}
    ErrAutoRecoveryInternal     = &AutoRecoveryError{Code: "autorecovery_internal", Message: "auto-recovery: internal error"}
)

func NewAutoRecoveryError(code, msg string) error { return &AutoRecoveryError{Code: code, Message: msg} }
func IsAutoRecoveryNotFound(err error) bool { return errors.Is(err, ErrAutoRecoveryNotFound) }
