package pipelinesse

import "errors"

type PipelineSseError struct { Code string; Message string; Cause error }

func (e *PipelineSseError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *PipelineSseError) Is(target error) bool { _, ok := target.(*PipelineSseError); return ok }
func (e *PipelineSseError) Unwrap() error { return e.Cause }

var (
    ErrPipelineSseNotFound     = &PipelineSseError{Code: "pipelinesse_not_found", Message: "pipeline-sse: not found"}
    ErrPipelineSseInvalidInput = &PipelineSseError{Code: "pipelinesse_invalid_input", Message: "pipeline-sse: invalid input"}
    ErrPipelineSseConflict     = &PipelineSseError{Code: "pipelinesse_conflict", Message: "pipeline-sse: conflict"}
    ErrPipelineSseUnauthorized = &PipelineSseError{Code: "pipelinesse_unauthorized", Message: "pipeline-sse: unauthorized"}
    ErrPipelineSseInternal     = &PipelineSseError{Code: "pipelinesse_internal", Message: "pipeline-sse: internal error"}
)

func NewPipelineSseError(code, msg string) error { return &PipelineSseError{Code: code, Message: msg} }
func IsPipelineSseNotFound(err error) bool { return errors.Is(err, ErrPipelineSseNotFound) }
