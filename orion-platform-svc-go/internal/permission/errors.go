package permission

import "errors"

type PermissionError struct { Code string; Message string; Cause error }

func (e *PermissionError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *PermissionError) Is(target error) bool { _, ok := target.(*PermissionError); return ok }
func (e *PermissionError) Unwrap() error { return e.Cause }

var (
    ErrPermissionNotFound     = &PermissionError{Code: "permission_not_found", Message: "permission: not found"}
    ErrPermissionInvalidInput = &PermissionError{Code: "permission_invalid_input", Message: "permission: invalid input"}
    ErrPermissionConflict     = &PermissionError{Code: "permission_conflict", Message: "permission: conflict"}
    ErrPermissionUnauthorized = &PermissionError{Code: "permission_unauthorized", Message: "permission: unauthorized"}
    ErrPermissionInternal     = &PermissionError{Code: "permission_internal", Message: "permission: internal error"}
)

func NewPermissionError(code, msg string) error { return &PermissionError{Code: code, Message: msg} }
func IsPermissionNotFound(err error) bool { return errors.Is(err, ErrPermissionNotFound) }
