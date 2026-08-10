package versionarchive

import "errors"

type VersionArchiveError struct { Code string; Message string; Cause error }

func (e *VersionArchiveError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *VersionArchiveError) Is(target error) bool { _, ok := target.(*VersionArchiveError); return ok }
func (e *VersionArchiveError) Unwrap() error { return e.Cause }

var (
    ErrVersionArchiveNotFound     = &VersionArchiveError{Code: "versionarchive_not_found", Message: "version-archive: not found"}
    ErrVersionArchiveInvalidInput = &VersionArchiveError{Code: "versionarchive_invalid_input", Message: "version-archive: invalid input"}
    ErrVersionArchiveConflict     = &VersionArchiveError{Code: "versionarchive_conflict", Message: "version-archive: conflict"}
    ErrVersionArchiveUnauthorized = &VersionArchiveError{Code: "versionarchive_unauthorized", Message: "version-archive: unauthorized"}
    ErrVersionArchiveInternal     = &VersionArchiveError{Code: "versionarchive_internal", Message: "version-archive: internal error"}
)

func NewVersionArchiveError(code, msg string) error { return &VersionArchiveError{Code: code, Message: msg} }
func IsVersionArchiveNotFound(err error) bool { return errors.Is(err, ErrVersionArchiveNotFound) }
