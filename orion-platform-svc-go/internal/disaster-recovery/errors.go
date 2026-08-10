package disasterrecovery

import "errors"

type DisasterRecoveryError struct { Code string; Message string; Cause error }

func (e *DisasterRecoveryError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *DisasterRecoveryError) Is(target error) bool { _, ok := target.(*DisasterRecoveryError); return ok }
func (e *DisasterRecoveryError) Unwrap() error { return e.Cause }

var (
    ErrDisasterRecoveryNotFound     = &DisasterRecoveryError{Code: "disasterrecovery_not_found", Message: "disaster-recovery: not found"}
    ErrDisasterRecoveryInvalidInput = &DisasterRecoveryError{Code: "disasterrecovery_invalid_input", Message: "disaster-recovery: invalid input"}
    ErrDisasterRecoveryConflict     = &DisasterRecoveryError{Code: "disasterrecovery_conflict", Message: "disaster-recovery: conflict"}
    ErrDisasterRecoveryUnauthorized = &DisasterRecoveryError{Code: "disasterrecovery_unauthorized", Message: "disaster-recovery: unauthorized"}
    ErrDisasterRecoveryInternal     = &DisasterRecoveryError{Code: "disasterrecovery_internal", Message: "disaster-recovery: internal error"}
)

func NewDisasterRecoveryError(code, msg string) error { return &DisasterRecoveryError{Code: code, Message: msg} }
func IsDisasterRecoveryNotFound(err error) bool { return errors.Is(err, ErrDisasterRecoveryNotFound) }
