package pipelineauditlog

import "errors"

type PipelineAuditLogError struct { Code string; Message string; Cause error }

func (e *PipelineAuditLogError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *PipelineAuditLogError) Is(target error) bool { _, ok := target.(*PipelineAuditLogError); return ok }
func (e *PipelineAuditLogError) Unwrap() error { return e.Cause }

var (
    ErrPipelineAuditLogNotFound     = &PipelineAuditLogError{Code: "pipelineauditlog_not_found", Message: "pipeline-audit-log: not found"}
    ErrPipelineAuditLogInvalidInput = &PipelineAuditLogError{Code: "pipelineauditlog_invalid_input", Message: "pipeline-audit-log: invalid input"}
    ErrPipelineAuditLogConflict     = &PipelineAuditLogError{Code: "pipelineauditlog_conflict", Message: "pipeline-audit-log: conflict"}
    ErrPipelineAuditLogUnauthorized = &PipelineAuditLogError{Code: "pipelineauditlog_unauthorized", Message: "pipeline-audit-log: unauthorized"}
    ErrPipelineAuditLogInternal     = &PipelineAuditLogError{Code: "pipelineauditlog_internal", Message: "pipeline-audit-log: internal error"}
)

func NewPipelineAuditLogError(code, msg string) error { return &PipelineAuditLogError{Code: code, Message: msg} }
func IsPipelineAuditLogNotFound(err error) bool { return errors.Is(err, ErrPipelineAuditLogNotFound) }
