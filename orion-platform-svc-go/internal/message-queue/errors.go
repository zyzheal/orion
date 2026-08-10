package messagequeue

import "errors"

type MessageQueueError struct { Code string; Message string; Cause error }

func (e *MessageQueueError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *MessageQueueError) Is(target error) bool { _, ok := target.(*MessageQueueError); return ok }
func (e *MessageQueueError) Unwrap() error { return e.Cause }

var (
    ErrMessageQueueNotFound     = &MessageQueueError{Code: "messagequeue_not_found", Message: "message-queue: not found"}
    ErrMessageQueueInvalidInput = &MessageQueueError{Code: "messagequeue_invalid_input", Message: "message-queue: invalid input"}
    ErrMessageQueueConflict     = &MessageQueueError{Code: "messagequeue_conflict", Message: "message-queue: conflict"}
    ErrMessageQueueUnauthorized = &MessageQueueError{Code: "messagequeue_unauthorized", Message: "message-queue: unauthorized"}
    ErrMessageQueueInternal     = &MessageQueueError{Code: "messagequeue_internal", Message: "message-queue: internal error"}
)

func NewMessageQueueError(code, msg string) error { return &MessageQueueError{Code: code, Message: msg} }
func IsMessageQueueNotFound(err error) bool { return errors.Is(err, ErrMessageQueueNotFound) }
