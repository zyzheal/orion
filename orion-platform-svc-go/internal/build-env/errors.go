package buildenv

import "errors"

// BuildEnvError represents domain errors for the build-env module.
type BuildEnvError struct {
    Code    string
    Message string
    Cause   error
}

func (e *BuildEnvError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *BuildEnvError) Is(target error) bool {
    _, ok := target.(*BuildEnvError)
    return ok
}

func (e *BuildEnvError) Unwrap() error {
    return e.Cause
}

var (
    ErrBuildEnvNotFound     = &BuildEnvError{Code: "buildenv_not_found", Message: "build-env: resource not found"}
    ErrBuildEnvInvalidInput = &BuildEnvError{Code: "buildenv_invalid_input", Message: "build-env: invalid input"}
    ErrBuildEnvConflict     = &BuildEnvError{Code: "buildenv_conflict", Message: "build-env: resource conflict"}
    ErrBuildEnvUnauthorized = &BuildEnvError{Code: "buildenv_unauthorized", Message: "build-env: unauthorized access"}
    ErrBuildEnvInternal     = &BuildEnvError{Code: "buildenv_internal", Message: "build-env: internal error"}
)

func NewBuildEnvError(code, message string) error {
    return &BuildEnvError{Code: code, Message: message}
}

func IsBuildEnvNotFound(err error) bool {
    return errors.Is(err, ErrBuildEnvNotFound)
}
