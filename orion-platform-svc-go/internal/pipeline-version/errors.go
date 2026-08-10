package pipelineversion

import "errors"

type PipelineVersionError struct { Code string; Message string; Cause error }

func (e *PipelineVersionError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *PipelineVersionError) Is(target error) bool { _, ok := target.(*PipelineVersionError); return ok }
func (e *PipelineVersionError) Unwrap() error { return e.Cause }

var (
    ErrPipelineVersionNotFound     = &PipelineVersionError{Code: "pipelineversion_not_found", Message: "pipeline-version: not found"}
    ErrPipelineVersionInvalidInput = &PipelineVersionError{Code: "pipelineversion_invalid_input", Message: "pipeline-version: invalid input"}
    ErrPipelineVersionConflict     = &PipelineVersionError{Code: "pipelineversion_conflict", Message: "pipeline-version: conflict"}
    ErrPipelineVersionUnauthorized = &PipelineVersionError{Code: "pipelineversion_unauthorized", Message: "pipeline-version: unauthorized"}
    ErrPipelineVersionInternal     = &PipelineVersionError{Code: "pipelineversion_internal", Message: "pipeline-version: internal error"}
)

func NewPipelineVersionError(code, msg string) error { return &PipelineVersionError{Code: code, Message: msg} }
func IsPipelineVersionNotFound(err error) bool { return errors.Is(err, ErrPipelineVersionNotFound) }
