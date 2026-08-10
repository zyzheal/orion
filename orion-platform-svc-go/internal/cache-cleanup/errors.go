package cachecleanup

import "errors"

type CacheCleanupError struct { Code string; Message string; Cause error }

func (e *CacheCleanupError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *CacheCleanupError) Is(target error) bool { _, ok := target.(*CacheCleanupError); return ok }
func (e *CacheCleanupError) Unwrap() error { return e.Cause }

var (
    ErrCacheCleanupNotFound     = &CacheCleanupError{Code: "cachecleanup_not_found", Message: "cache-cleanup: not found"}
    ErrCacheCleanupInvalidInput = &CacheCleanupError{Code: "cachecleanup_invalid_input", Message: "cache-cleanup: invalid input"}
    ErrCacheCleanupConflict     = &CacheCleanupError{Code: "cachecleanup_conflict", Message: "cache-cleanup: conflict"}
    ErrCacheCleanupUnauthorized = &CacheCleanupError{Code: "cachecleanup_unauthorized", Message: "cache-cleanup: unauthorized"}
    ErrCacheCleanupInternal     = &CacheCleanupError{Code: "cachecleanup_internal", Message: "cache-cleanup: internal error"}
)

func NewCacheCleanupError(code, msg string) error { return &CacheCleanupError{Code: code, Message: msg} }
func IsCacheCleanupNotFound(err error) bool { return errors.Is(err, ErrCacheCleanupNotFound) }
