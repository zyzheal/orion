package canarytraffic

import "errors"

type CanaryTrafficError struct { Code string; Message string; Cause error }

func (e *CanaryTrafficError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *CanaryTrafficError) Is(target error) bool { _, ok := target.(*CanaryTrafficError); return ok }
func (e *CanaryTrafficError) Unwrap() error { return e.Cause }

var (
    ErrCanaryTrafficNotFound     = &CanaryTrafficError{Code: "canarytraffic_not_found", Message: "canary-traffic: not found"}
    ErrCanaryTrafficInvalidInput = &CanaryTrafficError{Code: "canarytraffic_invalid_input", Message: "canary-traffic: invalid input"}
    ErrCanaryTrafficConflict     = &CanaryTrafficError{Code: "canarytraffic_conflict", Message: "canary-traffic: conflict"}
    ErrCanaryTrafficUnauthorized = &CanaryTrafficError{Code: "canarytraffic_unauthorized", Message: "canary-traffic: unauthorized"}
    ErrCanaryTrafficInternal     = &CanaryTrafficError{Code: "canarytraffic_internal", Message: "canary-traffic: internal error"}
)

func NewCanaryTrafficError(code, msg string) error { return &CanaryTrafficError{Code: code, Message: msg} }
func IsCanaryTrafficNotFound(err error) bool { return errors.Is(err, ErrCanaryTrafficNotFound) }
