package pipelinetemplate

import "errors"

type PipelineTemplateError struct { Code string; Message string; Cause error }

func (e *PipelineTemplateError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *PipelineTemplateError) Is(target error) bool { _, ok := target.(*PipelineTemplateError); return ok }
func (e *PipelineTemplateError) Unwrap() error { return e.Cause }

var (
    ErrPipelineTemplateNotFound     = &PipelineTemplateError{Code: "pipelinetemplate_not_found", Message: "pipeline-template: not found"}
    ErrPipelineTemplateInvalidInput = &PipelineTemplateError{Code: "pipelinetemplate_invalid_input", Message: "pipeline-template: invalid input"}
    ErrPipelineTemplateConflict     = &PipelineTemplateError{Code: "pipelinetemplate_conflict", Message: "pipeline-template: conflict"}
    ErrPipelineTemplateUnauthorized = &PipelineTemplateError{Code: "pipelinetemplate_unauthorized", Message: "pipeline-template: unauthorized"}
    ErrPipelineTemplateInternal     = &PipelineTemplateError{Code: "pipelinetemplate_internal", Message: "pipeline-template: internal error"}
)

func NewPipelineTemplateError(code, msg string) error { return &PipelineTemplateError{Code: code, Message: msg} }
func IsPipelineTemplateNotFound(err error) bool { return errors.Is(err, ErrPipelineTemplateNotFound) }
