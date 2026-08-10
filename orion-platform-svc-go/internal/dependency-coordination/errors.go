package dependencycoordination

import "errors"

type DependencyCoordinationError struct { Code string; Message string; Cause error }

func (e *DependencyCoordinationError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *DependencyCoordinationError) Is(target error) bool { _, ok := target.(*DependencyCoordinationError); return ok }
func (e *DependencyCoordinationError) Unwrap() error { return e.Cause }

var (
    ErrDependencyCoordinationNotFound     = &DependencyCoordinationError{Code: "dependencycoordination_not_found", Message: "dependency-coordination: not found"}
    ErrDependencyCoordinationInvalidInput = &DependencyCoordinationError{Code: "dependencycoordination_invalid_input", Message: "dependency-coordination: invalid input"}
    ErrDependencyCoordinationConflict     = &DependencyCoordinationError{Code: "dependencycoordination_conflict", Message: "dependency-coordination: conflict"}
    ErrDependencyCoordinationUnauthorized = &DependencyCoordinationError{Code: "dependencycoordination_unauthorized", Message: "dependency-coordination: unauthorized"}
    ErrDependencyCoordinationInternal     = &DependencyCoordinationError{Code: "dependencycoordination_internal", Message: "dependency-coordination: internal error"}
)

func NewDependencyCoordinationError(code, msg string) error { return &DependencyCoordinationError{Code: code, Message: msg} }
func IsDependencyCoordinationNotFound(err error) bool { return errors.Is(err, ErrDependencyCoordinationNotFound) }
