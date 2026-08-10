package useractivity

import "errors"

type UserActivityError struct { Code string; Message string; Cause error }

func (e *UserActivityError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *UserActivityError) Is(target error) bool { _, ok := target.(*UserActivityError); return ok }
func (e *UserActivityError) Unwrap() error { return e.Cause }

var (
    ErrUserActivityNotFound     = &UserActivityError{Code: "useractivity_not_found", Message: "user-activity: not found"}
    ErrUserActivityInvalidInput = &UserActivityError{Code: "useractivity_invalid_input", Message: "user-activity: invalid input"}
    ErrUserActivityConflict     = &UserActivityError{Code: "useractivity_conflict", Message: "user-activity: conflict"}
    ErrUserActivityUnauthorized = &UserActivityError{Code: "useractivity_unauthorized", Message: "user-activity: unauthorized"}
    ErrUserActivityInternal     = &UserActivityError{Code: "useractivity_internal", Message: "user-activity: internal error"}
)

func NewUserActivityError(code, msg string) error { return &UserActivityError{Code: code, Message: msg} }
func IsUserActivityNotFound(err error) bool { return errors.Is(err, ErrUserActivityNotFound) }
