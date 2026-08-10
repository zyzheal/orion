package project

import "errors"

type ProjectError struct { Code string; Message string; Cause error }

func (e *ProjectError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ProjectError) Is(target error) bool { _, ok := target.(*ProjectError); return ok }
func (e *ProjectError) Unwrap() error { return e.Cause }

var (
    ErrProjectNotFound     = &ProjectError{Code: "project_not_found", Message: "project: not found"}
    ErrProjectInvalidInput = &ProjectError{Code: "project_invalid_input", Message: "project: invalid input"}
    ErrProjectConflict     = &ProjectError{Code: "project_conflict", Message: "project: conflict"}
    ErrProjectUnauthorized = &ProjectError{Code: "project_unauthorized", Message: "project: unauthorized"}
    ErrProjectInternal     = &ProjectError{Code: "project_internal", Message: "project: internal error"}
)

func NewProjectError(code, msg string) error { return &ProjectError{Code: code, Message: msg} }
func IsProjectNotFound(err error) bool { return errors.Is(err, ErrProjectNotFound) }
