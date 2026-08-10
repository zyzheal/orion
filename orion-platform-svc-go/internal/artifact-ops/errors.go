package artifactops

import "errors"

type ArtifactOpsError struct { Code string; Message string; Cause error }

func (e *ArtifactOpsError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ArtifactOpsError) Is(target error) bool { _, ok := target.(*ArtifactOpsError); return ok }
func (e *ArtifactOpsError) Unwrap() error { return e.Cause }

var (
    ErrArtifactOpsNotFound     = &ArtifactOpsError{Code: "artifactops_not_found", Message: "artifact-ops: not found"}
    ErrArtifactOpsInvalidInput = &ArtifactOpsError{Code: "artifactops_invalid_input", Message: "artifact-ops: invalid input"}
    ErrArtifactOpsConflict     = &ArtifactOpsError{Code: "artifactops_conflict", Message: "artifact-ops: conflict"}
    ErrArtifactOpsUnauthorized = &ArtifactOpsError{Code: "artifactops_unauthorized", Message: "artifact-ops: unauthorized"}
    ErrArtifactOpsInternal     = &ArtifactOpsError{Code: "artifactops_internal", Message: "artifact-ops: internal error"}
)

func NewArtifactOpsError(code, msg string) error { return &ArtifactOpsError{Code: code, Message: msg} }
func IsArtifactOpsNotFound(err error) bool { return errors.Is(err, ErrArtifactOpsNotFound) }
