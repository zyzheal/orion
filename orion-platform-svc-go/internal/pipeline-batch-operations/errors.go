package pipelinebatchoperations

import "errors"

type PipelineBatchOperationsError struct { Code string; Message string; Cause error }

func (e *PipelineBatchOperationsError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *PipelineBatchOperationsError) Is(target error) bool { _, ok := target.(*PipelineBatchOperationsError); return ok }
func (e *PipelineBatchOperationsError) Unwrap() error { return e.Cause }

var (
    ErrPipelineBatchOperationsNotFound     = &PipelineBatchOperationsError{Code: "pipelinebatchoperations_not_found", Message: "pipeline-batch-operations: not found"}
    ErrPipelineBatchOperationsInvalidInput = &PipelineBatchOperationsError{Code: "pipelinebatchoperations_invalid_input", Message: "pipeline-batch-operations: invalid input"}
    ErrPipelineBatchOperationsConflict     = &PipelineBatchOperationsError{Code: "pipelinebatchoperations_conflict", Message: "pipeline-batch-operations: conflict"}
    ErrPipelineBatchOperationsUnauthorized = &PipelineBatchOperationsError{Code: "pipelinebatchoperations_unauthorized", Message: "pipeline-batch-operations: unauthorized"}
    ErrPipelineBatchOperationsInternal     = &PipelineBatchOperationsError{Code: "pipelinebatchoperations_internal", Message: "pipeline-batch-operations: internal error"}
)

func NewPipelineBatchOperationsError(code, msg string) error { return &PipelineBatchOperationsError{Code: code, Message: msg} }
func IsPipelineBatchOperationsNotFound(err error) bool { return errors.Is(err, ErrPipelineBatchOperationsNotFound) }
