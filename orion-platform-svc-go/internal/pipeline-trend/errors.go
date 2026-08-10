package pipelinetrend

import "errors"

type PipelineTrendError struct { Code string; Message string; Cause error }

func (e *PipelineTrendError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *PipelineTrendError) Is(target error) bool { _, ok := target.(*PipelineTrendError); return ok }
func (e *PipelineTrendError) Unwrap() error { return e.Cause }

var (
    ErrPipelineTrendNotFound     = &PipelineTrendError{Code: "pipelinetrend_not_found", Message: "pipeline-trend: not found"}
    ErrPipelineTrendInvalidInput = &PipelineTrendError{Code: "pipelinetrend_invalid_input", Message: "pipeline-trend: invalid input"}
    ErrPipelineTrendConflict     = &PipelineTrendError{Code: "pipelinetrend_conflict", Message: "pipeline-trend: conflict"}
    ErrPipelineTrendUnauthorized = &PipelineTrendError{Code: "pipelinetrend_unauthorized", Message: "pipeline-trend: unauthorized"}
    ErrPipelineTrendInternal     = &PipelineTrendError{Code: "pipelinetrend_internal", Message: "pipeline-trend: internal error"}
)

func NewPipelineTrendError(code, msg string) error { return &PipelineTrendError{Code: code, Message: msg} }
func IsPipelineTrendNotFound(err error) bool { return errors.Is(err, ErrPipelineTrendNotFound) }
