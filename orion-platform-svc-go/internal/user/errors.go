package user

import "errors"

type UserError struct { Code string; Message string; Cause error }

func (e *UserError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *UserError) Is(target error) bool { _, ok := target.(*UserError); return ok }
func (e *UserError) Unwrap() error { return e.Cause }

var (
    ErrUserNotFound     = &UserError{Code: "user_not_found", Message: "user: not found"}
    ErrUserInvalidInput = &UserError{Code: "user_invalid_input", Message: "user: invalid input"}
    ErrUserConflict     = &UserError{Code: "user_conflict", Message: "user: conflict"}
    ErrUserUnauthorized = &UserError{Code: "user_unauthorized", Message: "user: unauthorized"}
    ErrUserInternal     = &UserError{Code: "user_internal", Message: "user: internal error"}
)

func NewUserError(code, msg string) error { return &UserError{Code: code, Message: msg} }
func IsUserNotFound(err error) bool { return errors.Is(err, ErrUserNotFound) }
