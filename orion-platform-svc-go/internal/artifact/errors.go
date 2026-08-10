package artifact

import "errors"

// ArtifactError represents domain errors for the artifact module.
type ArtifactError struct {
    Code    string
    Message string
    Cause   error
}

func (e *ArtifactError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *ArtifactError) Is(target error) bool {
    _, ok := target.(*ArtifactError)
    return ok
}

func (e *ArtifactError) Unwrap() error {
    return e.Cause
}

var (
    ErrArtifactNotFound     = &ArtifactError{Code: "artifact_not_found", Message: "artifact: resource not found"}
    ErrArtifactInvalidInput = &ArtifactError{Code: "artifact_invalid_input", Message: "artifact: invalid input"}
    ErrArtifactConflict     = &ArtifactError{Code: "artifact_conflict", Message: "artifact: resource conflict"}
    ErrArtifactUnauthorized = &ArtifactError{Code: "artifact_unauthorized", Message: "artifact: unauthorized access"}
    ErrArtifactInternal     = &ArtifactError{Code: "artifact_internal", Message: "artifact: internal error"}
)

func NewArtifactError(code, message string) error {
    return &ArtifactError{Code: code, Message: message}
}

func IsArtifactNotFound(err error) bool {
    return errors.Is(err, ErrArtifactNotFound)
}
