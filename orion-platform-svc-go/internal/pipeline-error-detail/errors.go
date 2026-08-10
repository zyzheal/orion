package pipelineerrordetail

import "errors"

type PipelineErrorDetailError struct { Code string; Message string; Cause error }

func (e *PipelineErrorDetailError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *PipelineErrorDetailError) Is(target error) bool { _, ok := target.(*PipelineErrorDetailError); return ok }
func (e *PipelineErrorDetailError) Unwrap() error { return e.Cause }

var (
    ErrPipelineErrorDetailNotFound     = &PipelineErrorDetailError{Code: "pipelineerrordetail_not_found", Message: "pipeline-error-detail: not found"}
    ErrPipelineErrorDetailInvalidInput = &PipelineErrorDetailError{Code: "pipelineerrordetail_invalid_input", Message: "pipeline-error-detail: invalid input"}
    ErrPipelineErrorDetailConflict     = &PipelineErrorDetailError{Code: "pipelineerrordetail_conflict", Message: "pipeline-error-detail: conflict"}
    ErrPipelineErrorDetailUnauthorized = &PipelineErrorDetailError{Code: "pipelineerrordetail_unauthorized", Message: "pipeline-error-detail: unauthorized"}
    ErrPipelineErrorDetailInternal     = &PipelineErrorDetailError{Code: "pipelineerrordetail_internal", Message: "pipeline-error-detail: internal error"}
)

func NewPipelineErrorDetailError(code, msg string) error { return &PipelineErrorDetailError{Code: code, Message: msg} }
func IsPipelineErrorDetailNotFound(err error) bool { return errors.Is(err, ErrPipelineErrorDetailNotFound) }
