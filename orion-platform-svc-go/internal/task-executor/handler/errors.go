package handler

import "errors"

type TaskExecutorError struct { Code string; Message string; Cause error }

func (e *TaskExecutorError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *TaskExecutorError) Is(target error) bool { _, ok := target.(*TaskExecutorError); return ok }
func (e *TaskExecutorError) Unwrap() error { return e.Cause }

var (
    ErrTaskExecutorNotFound     = &TaskExecutorError{Code: "taskexecutor_not_found", Message: "task-executor: not found"}
    ErrTaskExecutorInvalidInput = &TaskExecutorError{Code: "taskexecutor_invalid_input", Message: "task-executor: invalid input"}
    ErrTaskExecutorConflict     = &TaskExecutorError{Code: "taskexecutor_conflict", Message: "task-executor: conflict"}
    ErrTaskExecutorUnauthorized = &TaskExecutorError{Code: "taskexecutor_unauthorized", Message: "task-executor: unauthorized"}
    ErrTaskExecutorInternal     = &TaskExecutorError{Code: "taskexecutor_internal", Message: "task-executor: internal error"}
)

func NewTaskExecutorError(code, msg string) error { return &TaskExecutorError{Code: code, Message: msg} }
func IsTaskExecutorNotFound(err error) bool { return errors.Is(err, ErrTaskExecutorNotFound) }
