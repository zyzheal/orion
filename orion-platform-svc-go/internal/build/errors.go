package build

import "errors"

type BuildError struct { Code string; Message string; Cause error }

func (e *BuildError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *BuildError) Is(target error) bool { _, ok := target.(*BuildError); return ok }
func (e *BuildError) Unwrap() error { return e.Cause }

var (
    ErrBuildNotFound     = &BuildError{Code: "build_not_found", Message: "build: not found"}
    ErrBuildInvalidInput = &BuildError{Code: "build_invalid_input", Message: "build: invalid input"}
    ErrBuildConflict     = &BuildError{Code: "build_conflict", Message: "build: conflict"}
    ErrBuildUnauthorized = &BuildError{Code: "build_unauthorized", Message: "build: unauthorized"}
    ErrBuildInternal     = &BuildError{Code: "build_internal", Message: "build: internal error"}
)

func NewBuildError(code, msg string) error { return &BuildError{Code: code, Message: msg} }
func IsBuildNotFound(err error) bool { return errors.Is(err, ErrBuildNotFound) }
