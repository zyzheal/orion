// Package idempotency provides idempotency-key based deduplication,
// retry-with-backoff helpers and a token-bucket rate limiter for write
// operations.  It works with Gin (middleware.go) or can be used as a
// standalone Processor (processor.go).
package idempotency

import "errors"

// Public sentinel errors.

var (
	// ErrKeyExpired is returned when an idempotency key is no longer
	// present in the backing store (TTL expired).
	ErrKeyExpired = errors.New("idempotency key expired")

	// ErrConflict is returned when the stored payload for a key differs
	// from the payload produced by a fresh request, indicating that the
	// same key is being used for different operations.
	ErrConflict = errors.New("idempotency conflict: key exists but processing differs")

	// ErrTooManyReqs is returned by the TokenBucket when no tokens are
	// available and Allow() would block.
	ErrTooManyReqs = errors.New("too many requests: token bucket exhausted")
)

// IdempotencyError wraps a downstream error with the key that caused it.
type IdempotencyError struct {
	Key string
	Err error
}

func (e *IdempotencyError) Error() string {
	return "idempotency error [key=" + e.Key + "]: " + e.Err.Error()
}

// Is implements errors.Is so callers can match IdempotencyError in
// errors.Is(err, &IdempotencyError{}).
func (e *IdempotencyError) Is(target error) bool {
	_, ok := target.(*IdempotencyError)
	return ok
}

func (e *IdempotencyError) Unwrap() error {
	return e.Err
}
