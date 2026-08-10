package serverless

import "errors"

// ServerlessError represents domain errors for the serverless module.
type ServerlessError struct {
    Code    string
    Message string
    Cause   error
}

func (e *ServerlessError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *ServerlessError) Is(target error) bool {
    _, ok := target.(*ServerlessError)
    return ok
}

func (e *ServerlessError) Unwrap() error {
    return e.Cause
}

var (
    ErrServerlessNotFound     = &ServerlessError{Code: "serverless_not_found", Message: "serverless: resource not found"}
    ErrServerlessInvalidInput = &ServerlessError{Code: "serverless_invalid_input", Message: "serverless: invalid input"}
    ErrServerlessConflict     = &ServerlessError{Code: "serverless_conflict", Message: "serverless: resource conflict"}
    ErrServerlessUnauthorized = &ServerlessError{Code: "serverless_unauthorized", Message: "serverless: unauthorized access"}
    ErrServerlessInternal     = &ServerlessError{Code: "serverless_internal", Message: "serverless: internal error"}
)

func NewServerlessError(code, message string) error {
    return &ServerlessError{Code: code, Message: message}
}

func IsServerlessNotFound(err error) bool {
    return errors.Is(err, ErrServerlessNotFound)
}
