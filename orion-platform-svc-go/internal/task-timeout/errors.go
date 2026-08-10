package tasktimeout

import "errors"

type TaskTimeoutError struct { Code string; Message string; Cause error }

func (e *TaskTimeoutError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *TaskTimeoutError) Is(target error) bool { _, ok := target.(*TaskTimeoutError); return ok }
func (e *TaskTimeoutError) Unwrap() error { return e.Cause }

var (
    ErrTaskTimeoutNotFound     = &TaskTimeoutError{Code: "tasktimeout_not_found", Message: "task-timeout: not found"}
    ErrTaskTimeoutInvalidInput = &TaskTimeoutError{Code: "tasktimeout_invalid_input", Message: "task-timeout: invalid input"}
    ErrTaskTimeoutConflict     = &TaskTimeoutError{Code: "tasktimeout_conflict", Message: "task-timeout: conflict"}
    ErrTaskTimeoutUnauthorized = &TaskTimeoutError{Code: "tasktimeout_unauthorized", Message: "task-timeout: unauthorized"}
    ErrTaskTimeoutInternal     = &TaskTimeoutError{Code: "tasktimeout_internal", Message: "task-timeout: internal error"}
)

func NewTaskTimeoutError(code, msg string) error { return &TaskTimeoutError{Code: code, Message: msg} }
func IsTaskTimeoutNotFound(err error) bool { return errors.Is(err, ErrTaskTimeoutNotFound) }
