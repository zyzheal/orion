package usertoken

import "errors"

type UserTokenError struct { Code string; Message string; Cause error }

func (e *UserTokenError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *UserTokenError) Is(target error) bool { _, ok := target.(*UserTokenError); return ok }
func (e *UserTokenError) Unwrap() error { return e.Cause }

var (
    ErrUserTokenNotFound     = &UserTokenError{Code: "usertoken_not_found", Message: "user-token: not found"}
    ErrUserTokenInvalidInput = &UserTokenError{Code: "usertoken_invalid_input", Message: "user-token: invalid input"}
    ErrUserTokenConflict     = &UserTokenError{Code: "usertoken_conflict", Message: "user-token: conflict"}
    ErrUserTokenUnauthorized = &UserTokenError{Code: "usertoken_unauthorized", Message: "user-token: unauthorized"}
    ErrUserTokenInternal     = &UserTokenError{Code: "usertoken_internal", Message: "user-token: internal error"}
)

func NewUserTokenError(code, msg string) error { return &UserTokenError{Code: code, Message: msg} }
func IsUserTokenNotFound(err error) bool { return errors.Is(err, ErrUserTokenNotFound) }
