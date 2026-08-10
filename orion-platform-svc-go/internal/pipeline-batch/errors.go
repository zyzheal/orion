package pipelinebatch

import "errors"

type PipelineBatchError struct { Code string; Message string; Cause error }

func (e *PipelineBatchError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *PipelineBatchError) Is(target error) bool { _, ok := target.(*PipelineBatchError); return ok }
func (e *PipelineBatchError) Unwrap() error { return e.Cause }

var (
    ErrPipelineBatchNotFound     = &PipelineBatchError{Code: "pipelinebatch_not_found", Message: "pipeline-batch: not found"}
    ErrPipelineBatchInvalidInput = &PipelineBatchError{Code: "pipelinebatch_invalid_input", Message: "pipeline-batch: invalid input"}
    ErrPipelineBatchConflict     = &PipelineBatchError{Code: "pipelinebatch_conflict", Message: "pipeline-batch: conflict"}
    ErrPipelineBatchUnauthorized = &PipelineBatchError{Code: "pipelinebatch_unauthorized", Message: "pipeline-batch: unauthorized"}
    ErrPipelineBatchInternal     = &PipelineBatchError{Code: "pipelinebatch_internal", Message: "pipeline-batch: internal error"}
)

func NewPipelineBatchError(code, msg string) error { return &PipelineBatchError{Code: code, Message: msg} }
func IsPipelineBatchNotFound(err error) bool { return errors.Is(err, ErrPipelineBatchNotFound) }
