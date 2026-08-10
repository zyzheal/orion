package channel

import "errors"

type ChannelError struct { Code string; Message string; Cause error }

func (e *ChannelError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ChannelError) Is(target error) bool { _, ok := target.(*ChannelError); return ok }
func (e *ChannelError) Unwrap() error { return e.Cause }

var (
    ErrChannelNotFound     = &ChannelError{Code: "channel_not_found", Message: "channel: not found"}
    ErrChannelInvalidInput = &ChannelError{Code: "channel_invalid_input", Message: "channel: invalid input"}
    ErrChannelConflict     = &ChannelError{Code: "channel_conflict", Message: "channel: conflict"}
    ErrChannelUnauthorized = &ChannelError{Code: "channel_unauthorized", Message: "channel: unauthorized"}
    ErrChannelInternal     = &ChannelError{Code: "channel_internal", Message: "channel: internal error"}
)

func NewChannelError(code, msg string) error { return &ChannelError{Code: code, Message: msg} }
func IsChannelNotFound(err error) bool { return errors.Is(err, ErrChannelNotFound) }
