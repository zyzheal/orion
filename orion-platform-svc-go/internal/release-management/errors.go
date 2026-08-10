package releasemanagement

import "errors"

type ReleaseManagementError struct { Code string; Message string; Cause error }

func (e *ReleaseManagementError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ReleaseManagementError) Is(target error) bool { _, ok := target.(*ReleaseManagementError); return ok }
func (e *ReleaseManagementError) Unwrap() error { return e.Cause }

var (
    ErrReleaseManagementNotFound     = &ReleaseManagementError{Code: "releasemanagement_not_found", Message: "release-management: not found"}
    ErrReleaseManagementInvalidInput = &ReleaseManagementError{Code: "releasemanagement_invalid_input", Message: "release-management: invalid input"}
    ErrReleaseManagementConflict     = &ReleaseManagementError{Code: "releasemanagement_conflict", Message: "release-management: conflict"}
    ErrReleaseManagementUnauthorized = &ReleaseManagementError{Code: "releasemanagement_unauthorized", Message: "release-management: unauthorized"}
    ErrReleaseManagementInternal     = &ReleaseManagementError{Code: "releasemanagement_internal", Message: "release-management: internal error"}
)

func NewReleaseManagementError(code, msg string) error { return &ReleaseManagementError{Code: code, Message: msg} }
func IsReleaseManagementNotFound(err error) bool { return errors.Is(err, ErrReleaseManagementNotFound) }
