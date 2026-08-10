package userprofile

import "errors"

type UserProfileError struct { Code string; Message string; Cause error }

func (e *UserProfileError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *UserProfileError) Is(target error) bool { _, ok := target.(*UserProfileError); return ok }
func (e *UserProfileError) Unwrap() error { return e.Cause }

var (
    ErrUserProfileNotFound     = &UserProfileError{Code: "userprofile_not_found", Message: "user-profile: not found"}
    ErrUserProfileInvalidInput = &UserProfileError{Code: "userprofile_invalid_input", Message: "user-profile: invalid input"}
    ErrUserProfileConflict     = &UserProfileError{Code: "userprofile_conflict", Message: "user-profile: conflict"}
    ErrUserProfileUnauthorized = &UserProfileError{Code: "userprofile_unauthorized", Message: "user-profile: unauthorized"}
    ErrUserProfileInternal     = &UserProfileError{Code: "userprofile_internal", Message: "user-profile: internal error"}
)

func NewUserProfileError(code, msg string) error { return &UserProfileError{Code: code, Message: msg} }
func IsUserProfileNotFound(err error) bool { return errors.Is(err, ErrUserProfileNotFound) }
