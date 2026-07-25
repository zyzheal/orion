package processor

import (
	"errors"
	"fmt"
)

// Sentinel errors for integration processing.
var (
	ErrHandlerNotFound     = errors.New("integration: no handler for type")
	ErrIntegrationDisabled = errors.New("integration: integration is disabled")
	ErrInvalidType         = errors.New("integration: unsupported integration type")
	ErrInvalidInput        = errors.New("integration: invalid input data")
	ErrInvalidTransform    = errors.New("integration: invalid transformation")
	ErrOperationTimeout    = errors.New("integration: operation timed out")
	ErrTransformNotFound   = errors.New("integration: transform rule not found")
	ErrMaxRetriesExceeded  = errors.New("integration: maximum retries exceeded")
)

// RetryableError wraps an error and signals that the operation may succeed on retry.
type RetryableError struct {
	Msg   string
	Cause error
}

func (e *RetryableError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %v", e.Msg, e.Cause)
	}
	return e.Msg
}

func (e *RetryableError) Unwrap() error {
	return e.Cause
}

// NewRetryableError creates a retryable error.
func NewRetryableError(msg string, cause error) *RetryableError {
	return &RetryableError{Msg: msg, Cause: cause}
}

// IsRetryable reports whether an error is retryable.
func IsRetryable(err error) bool {
	var r *RetryableError
	return errors.As(err, &r)
}
