package pipelinerunhistory

import "errors"

type PipelineRunHistoryError struct { Code string; Message string; Cause error }

func (e *PipelineRunHistoryError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *PipelineRunHistoryError) Is(target error) bool { _, ok := target.(*PipelineRunHistoryError); return ok }
func (e *PipelineRunHistoryError) Unwrap() error { return e.Cause }

var (
    ErrPipelineRunHistoryNotFound     = &PipelineRunHistoryError{Code: "pipelinerunhistory_not_found", Message: "pipeline-run-history: not found"}
    ErrPipelineRunHistoryInvalidInput = &PipelineRunHistoryError{Code: "pipelinerunhistory_invalid_input", Message: "pipeline-run-history: invalid input"}
    ErrPipelineRunHistoryConflict     = &PipelineRunHistoryError{Code: "pipelinerunhistory_conflict", Message: "pipeline-run-history: conflict"}
    ErrPipelineRunHistoryUnauthorized = &PipelineRunHistoryError{Code: "pipelinerunhistory_unauthorized", Message: "pipeline-run-history: unauthorized"}
    ErrPipelineRunHistoryInternal     = &PipelineRunHistoryError{Code: "pipelinerunhistory_internal", Message: "pipeline-run-history: internal error"}
)

func NewPipelineRunHistoryError(code, msg string) error { return &PipelineRunHistoryError{Code: code, Message: msg} }
func IsPipelineRunHistoryNotFound(err error) bool { return errors.Is(err, ErrPipelineRunHistoryNotFound) }
