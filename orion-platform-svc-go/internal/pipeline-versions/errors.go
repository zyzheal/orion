package pipelineversions

import "errors"

// PipelineVersionsError represents domain errors for the pipeline-versions module.
type PipelineVersionsError struct {
    Code    string
    Message string
    Cause   error
}

func (e *PipelineVersionsError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *PipelineVersionsError) Is(target error) bool {
    _, ok := target.(*PipelineVersionsError)
    return ok
}

func (e *PipelineVersionsError) Unwrap() error {
    return e.Cause
}

var (
    ErrPipelineVersionsNotFound     = &PipelineVersionsError{Code: "pipelineversions_not_found", Message: "pipeline-versions: resource not found"}
    ErrPipelineVersionsInvalidInput = &PipelineVersionsError{Code: "pipelineversions_invalid_input", Message: "pipeline-versions: invalid input"}
    ErrPipelineVersionsConflict     = &PipelineVersionsError{Code: "pipelineversions_conflict", Message: "pipeline-versions: resource conflict"}
    ErrPipelineVersionsUnauthorized = &PipelineVersionsError{Code: "pipelineversions_unauthorized", Message: "pipeline-versions: unauthorized access"}
    ErrPipelineVersionsInternal     = &PipelineVersionsError{Code: "pipelineversions_internal", Message: "pipeline-versions: internal error"}
)

func NewPipelineVersionsError(code, message string) error {
    return &PipelineVersionsError{Code: code, Message: message}
}

func IsPipelineVersionsNotFound(err error) bool {
    return errors.Is(err, ErrPipelineVersionsNotFound)
}
