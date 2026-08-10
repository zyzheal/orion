package handler

import "errors"

type CmdbDriftError struct { Code string; Message string; Cause error }

func (e *CmdbDriftError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *CmdbDriftError) Is(target error) bool { _, ok := target.(*CmdbDriftError); return ok }
func (e *CmdbDriftError) Unwrap() error { return e.Cause }

var (
    ErrCmdbDriftNotFound     = &CmdbDriftError{Code: "cmdbdrift_not_found", Message: "cmdb-drift: not found"}
    ErrCmdbDriftInvalidInput = &CmdbDriftError{Code: "cmdbdrift_invalid_input", Message: "cmdb-drift: invalid input"}
    ErrCmdbDriftConflict     = &CmdbDriftError{Code: "cmdbdrift_conflict", Message: "cmdb-drift: conflict"}
    ErrCmdbDriftUnauthorized = &CmdbDriftError{Code: "cmdbdrift_unauthorized", Message: "cmdb-drift: unauthorized"}
    ErrCmdbDriftInternal     = &CmdbDriftError{Code: "cmdbdrift_internal", Message: "cmdb-drift: internal error"}
)

func NewCmdbDriftError(code, msg string) error { return &CmdbDriftError{Code: code, Message: msg} }
func IsCmdbDriftNotFound(err error) bool { return errors.Is(err, ErrCmdbDriftNotFound) }
