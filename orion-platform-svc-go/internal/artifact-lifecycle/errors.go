package artifactlifecycle

import "errors"

type ArtifactLifecycleError struct { Code string; Message string; Cause error }

func (e *ArtifactLifecycleError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ArtifactLifecycleError) Is(target error) bool { _, ok := target.(*ArtifactLifecycleError); return ok }
func (e *ArtifactLifecycleError) Unwrap() error { return e.Cause }

var (
    ErrArtifactLifecycleNotFound     = &ArtifactLifecycleError{Code: "artifactlifecycle_not_found", Message: "artifact-lifecycle: not found"}
    ErrArtifactLifecycleInvalidInput = &ArtifactLifecycleError{Code: "artifactlifecycle_invalid_input", Message: "artifact-lifecycle: invalid input"}
    ErrArtifactLifecycleConflict     = &ArtifactLifecycleError{Code: "artifactlifecycle_conflict", Message: "artifact-lifecycle: conflict"}
    ErrArtifactLifecycleUnauthorized = &ArtifactLifecycleError{Code: "artifactlifecycle_unauthorized", Message: "artifact-lifecycle: unauthorized"}
    ErrArtifactLifecycleInternal     = &ArtifactLifecycleError{Code: "artifactlifecycle_internal", Message: "artifact-lifecycle: internal error"}
)

func NewArtifactLifecycleError(code, msg string) error { return &ArtifactLifecycleError{Code: code, Message: msg} }
func IsArtifactLifecycleNotFound(err error) bool { return errors.Is(err, ErrArtifactLifecycleNotFound) }
