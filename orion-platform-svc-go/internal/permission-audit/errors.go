package permissionaudit

import "errors"

type PermissionAuditError struct { Code string; Message string; Cause error }

func (e *PermissionAuditError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *PermissionAuditError) Is(target error) bool { _, ok := target.(*PermissionAuditError); return ok }
func (e *PermissionAuditError) Unwrap() error { return e.Cause }

var (
    ErrPermissionAuditNotFound     = &PermissionAuditError{Code: "permissionaudit_not_found", Message: "permission-audit: not found"}
    ErrPermissionAuditInvalidInput = &PermissionAuditError{Code: "permissionaudit_invalid_input", Message: "permission-audit: invalid input"}
    ErrPermissionAuditConflict     = &PermissionAuditError{Code: "permissionaudit_conflict", Message: "permission-audit: conflict"}
    ErrPermissionAuditUnauthorized = &PermissionAuditError{Code: "permissionaudit_unauthorized", Message: "permission-audit: unauthorized"}
    ErrPermissionAuditInternal     = &PermissionAuditError{Code: "permissionaudit_internal", Message: "permission-audit: internal error"}
)

func NewPermissionAuditError(code, msg string) error { return &PermissionAuditError{Code: code, Message: msg} }
func IsPermissionAuditNotFound(err error) bool { return errors.Is(err, ErrPermissionAuditNotFound) }
