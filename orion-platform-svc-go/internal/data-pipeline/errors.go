package datapipeline

import "errors"

type DataPipelineError struct { Code string; Message string; Cause error }

func (e *DataPipelineError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *DataPipelineError) Is(target error) bool { _, ok := target.(*DataPipelineError); return ok }
func (e *DataPipelineError) Unwrap() error { return e.Cause }

var (
    ErrDataPipelineNotFound     = &DataPipelineError{Code: "datapipeline_not_found", Message: "data-pipeline: not found"}
    ErrDataPipelineInvalidInput = &DataPipelineError{Code: "datapipeline_invalid_input", Message: "data-pipeline: invalid input"}
    ErrDataPipelineConflict     = &DataPipelineError{Code: "datapipeline_conflict", Message: "data-pipeline: conflict"}
    ErrDataPipelineUnauthorized = &DataPipelineError{Code: "datapipeline_unauthorized", Message: "data-pipeline: unauthorized"}
    ErrDataPipelineInternal     = &DataPipelineError{Code: "datapipeline_internal", Message: "data-pipeline: internal error"}
)

func NewDataPipelineError(code, msg string) error { return &DataPipelineError{Code: code, Message: msg} }
func IsDataPipelineNotFound(err error) bool { return errors.Is(err, ErrDataPipelineNotFound) }
