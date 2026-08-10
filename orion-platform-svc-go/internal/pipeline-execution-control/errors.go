package pipelineexecutioncontrol

import "errors"

type PipelineExecutionControlError struct { Code string; Message string; Cause error }

func (e *PipelineExecutionControlError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *PipelineExecutionControlError) Is(target error) bool { _, ok := target.(*PipelineExecutionControlError); return ok }
func (e *PipelineExecutionControlError) Unwrap() error { return e.Cause }

var (
    ErrPipelineExecutionControlNotFound     = &PipelineExecutionControlError{Code: "pipelineexecutioncontrol_not_found", Message: "pipeline-execution-control: not found"}
    ErrPipelineExecutionControlInvalidInput = &PipelineExecutionControlError{Code: "pipelineexecutioncontrol_invalid_input", Message: "pipeline-execution-control: invalid input"}
    ErrPipelineExecutionControlConflict     = &PipelineExecutionControlError{Code: "pipelineexecutioncontrol_conflict", Message: "pipeline-execution-control: conflict"}
    ErrPipelineExecutionControlUnauthorized = &PipelineExecutionControlError{Code: "pipelineexecutioncontrol_unauthorized", Message: "pipeline-execution-control: unauthorized"}
    ErrPipelineExecutionControlInternal     = &PipelineExecutionControlError{Code: "pipelineexecutioncontrol_internal", Message: "pipeline-execution-control: internal error"}
)

func NewPipelineExecutionControlError(code, msg string) error { return &PipelineExecutionControlError{Code: code, Message: msg} }
func IsPipelineExecutionControlNotFound(err error) bool { return errors.Is(err, ErrPipelineExecutionControlNotFound) }
