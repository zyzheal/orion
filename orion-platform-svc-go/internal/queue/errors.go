package queue

import "errors"

type QueueError struct { Code string; Message string; Cause error }

func (e *QueueError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *QueueError) Is(target error) bool { _, ok := target.(*QueueError); return ok }
func (e *QueueError) Unwrap() error { return e.Cause }

var (
    ErrQueueNotFound     = &QueueError{Code: "queue_not_found", Message: "queue: not found"}
    ErrQueueInvalidInput = &QueueError{Code: "queue_invalid_input", Message: "queue: invalid input"}
    ErrQueueConflict     = &QueueError{Code: "queue_conflict", Message: "queue: conflict"}
    ErrQueueUnauthorized = &QueueError{Code: "queue_unauthorized", Message: "queue: unauthorized"}
    ErrQueueInternal     = &QueueError{Code: "queue_internal", Message: "queue: internal error"}
)

func NewQueueError(code, msg string) error { return &QueueError{Code: code, Message: msg} }
func IsQueueNotFound(err error) bool { return errors.Is(err, ErrQueueNotFound) }
