package chatops

import "errors"

// ChatopsError represents domain errors for the chatops module.
type ChatopsError struct {
    Code    string
    Message string
    Cause   error
}

func (e *ChatopsError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *ChatopsError) Is(target error) bool {
    _, ok := target.(*ChatopsError)
    return ok
}

func (e *ChatopsError) Unwrap() error {
    return e.Cause
}

var (
    ErrChatopsNotFound     = &ChatopsError{Code: "chatops_not_found", Message: "chatops: resource not found"}
    ErrChatopsInvalidInput = &ChatopsError{Code: "chatops_invalid_input", Message: "chatops: invalid input"}
    ErrChatopsConflict     = &ChatopsError{Code: "chatops_conflict", Message: "chatops: resource conflict"}
    ErrChatopsUnauthorized = &ChatopsError{Code: "chatops_unauthorized", Message: "chatops: unauthorized access"}
    ErrChatopsInternal     = &ChatopsError{Code: "chatops_internal", Message: "chatops: internal error"}
)

func NewChatopsError(code, message string) error {
    return &ChatopsError{Code: code, Message: message}
}

func IsChatopsNotFound(err error) bool {
    return errors.Is(err, ErrChatopsNotFound)
}
