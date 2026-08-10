package role

import "errors"

type RoleError struct { Code string; Message string; Cause error }

func (e *RoleError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *RoleError) Is(target error) bool { _, ok := target.(*RoleError); return ok }
func (e *RoleError) Unwrap() error { return e.Cause }

var (
    ErrRoleNotFound     = &RoleError{Code: "role_not_found", Message: "role: not found"}
    ErrRoleInvalidInput = &RoleError{Code: "role_invalid_input", Message: "role: invalid input"}
    ErrRoleConflict     = &RoleError{Code: "role_conflict", Message: "role: conflict"}
    ErrRoleUnauthorized = &RoleError{Code: "role_unauthorized", Message: "role: unauthorized"}
    ErrRoleInternal     = &RoleError{Code: "role_internal", Message: "role: internal error"}
)

func NewRoleError(code, msg string) error { return &RoleError{Code: code, Message: msg} }
func IsRoleNotFound(err error) bool { return errors.Is(err, ErrRoleNotFound) }
