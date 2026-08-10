package logging

import "errors"

type LoggingError struct { Code string; Message string; Cause error }

func (e *LoggingError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *LoggingError) Is(target error) bool { _, ok := target.(*LoggingError); return ok }
func (e *LoggingError) Unwrap() error { return e.Cause }

var (
    ErrLoggingNotFound     = &LoggingError{Code: "logging_not_found", Message: "logging: not found"}
    ErrLoggingInvalidInput = &LoggingError{Code: "logging_invalid_input", Message: "logging: invalid input"}
    ErrLoggingConflict     = &LoggingError{Code: "logging_conflict", Message: "logging: conflict"}
    ErrLoggingUnauthorized = &LoggingError{Code: "logging_unauthorized", Message: "logging: unauthorized"}
    ErrLoggingInternal     = &LoggingError{Code: "logging_internal", Message: "logging: internal error"}
)

func NewLoggingError(code, msg string) error { return &LoggingError{Code: code, Message: msg} }
func IsLoggingNotFound(err error) bool { return errors.Is(err, ErrLoggingNotFound) }
