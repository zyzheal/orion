package privacy

import "errors"

type PrivacyError struct { Code string; Message string; Cause error }

func (e *PrivacyError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *PrivacyError) Is(target error) bool { _, ok := target.(*PrivacyError); return ok }
func (e *PrivacyError) Unwrap() error { return e.Cause }

var (
    ErrPrivacyNotFound     = &PrivacyError{Code: "privacy_not_found", Message: "privacy: not found"}
    ErrPrivacyInvalidInput = &PrivacyError{Code: "privacy_invalid_input", Message: "privacy: invalid input"}
    ErrPrivacyConflict     = &PrivacyError{Code: "privacy_conflict", Message: "privacy: conflict"}
    ErrPrivacyUnauthorized = &PrivacyError{Code: "privacy_unauthorized", Message: "privacy: unauthorized"}
    ErrPrivacyInternal     = &PrivacyError{Code: "privacy_internal", Message: "privacy: internal error"}
)

func NewPrivacyError(code, msg string) error { return &PrivacyError{Code: code, Message: msg} }
func IsPrivacyNotFound(err error) bool { return errors.Is(err, ErrPrivacyNotFound) }
