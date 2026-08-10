package donotdisturb

import "errors"

type DoNotDisturbError struct { Code string; Message string; Cause error }

func (e *DoNotDisturbError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *DoNotDisturbError) Is(target error) bool { _, ok := target.(*DoNotDisturbError); return ok }
func (e *DoNotDisturbError) Unwrap() error { return e.Cause }

var (
    ErrDoNotDisturbNotFound     = &DoNotDisturbError{Code: "donotdisturb_not_found", Message: "do-not-disturb: not found"}
    ErrDoNotDisturbInvalidInput = &DoNotDisturbError{Code: "donotdisturb_invalid_input", Message: "do-not-disturb: invalid input"}
    ErrDoNotDisturbConflict     = &DoNotDisturbError{Code: "donotdisturb_conflict", Message: "do-not-disturb: conflict"}
    ErrDoNotDisturbUnauthorized = &DoNotDisturbError{Code: "donotdisturb_unauthorized", Message: "do-not-disturb: unauthorized"}
    ErrDoNotDisturbInternal     = &DoNotDisturbError{Code: "donotdisturb_internal", Message: "do-not-disturb: internal error"}
)

func NewDoNotDisturbError(code, msg string) error { return &DoNotDisturbError{Code: code, Message: msg} }
func IsDoNotDisturbNotFound(err error) bool { return errors.Is(err, ErrDoNotDisturbNotFound) }
