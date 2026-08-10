package pipeline

import "errors"

// PipelineError represents domain errors for the pipeline module.
type PipelineError struct {
    Code    string
    Message string
    Cause   error
}

func (e *PipelineError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *PipelineError) Is(target error) bool {
    _, ok := target.(*PipelineError)
    return ok
}

func (e *PipelineError) Unwrap() error {
    return e.Cause
}

var (
    ErrPipelineNotFound     = &PipelineError{Code: "pipeline_not_found", Message: "pipeline: resource not found"}
    ErrPipelineInvalidInput = &PipelineError{Code: "pipeline_invalid_input", Message: "pipeline: invalid input"}
    ErrPipelineConflict     = &PipelineError{Code: "pipeline_conflict", Message: "pipeline: resource conflict"}
    ErrPipelineUnauthorized = &PipelineError{Code: "pipeline_unauthorized", Message: "pipeline: unauthorized access"}
    ErrPipelineInternal     = &PipelineError{Code: "pipeline_internal", Message: "pipeline: internal error"}
)

func NewPipelineError(code, message string) error {
    return &PipelineError{Code: code, Message: message}
}

func IsPipelineNotFound(err error) bool {
    return errors.Is(err, ErrPipelineNotFound)
}
