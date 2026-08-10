package userstatus

import "errors"

type UserStatusError struct { Code string; Message string; Cause error }

func (e *UserStatusError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *UserStatusError) Is(target error) bool { _, ok := target.(*UserStatusError); return ok }
func (e *UserStatusError) Unwrap() error { return e.Cause }

var (
    ErrUserStatusNotFound     = &UserStatusError{Code: "userstatus_not_found", Message: "user-status: not found"}
    ErrUserStatusInvalidInput = &UserStatusError{Code: "userstatus_invalid_input", Message: "user-status: invalid input"}
    ErrUserStatusConflict     = &UserStatusError{Code: "userstatus_conflict", Message: "user-status: conflict"}
    ErrUserStatusUnauthorized = &UserStatusError{Code: "userstatus_unauthorized", Message: "user-status: unauthorized"}
    ErrUserStatusInternal     = &UserStatusError{Code: "userstatus_internal", Message: "user-status: internal error"}
)

func NewUserStatusError(code, msg string) error { return &UserStatusError{Code: code, Message: msg} }
func IsUserStatusNotFound(err error) bool { return errors.Is(err, ErrUserStatusNotFound) }
