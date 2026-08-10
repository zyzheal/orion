package cache

import "errors"

type CacheError struct { Code string; Message string; Cause error }

func (e *CacheError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *CacheError) Is(target error) bool { _, ok := target.(*CacheError); return ok }
func (e *CacheError) Unwrap() error { return e.Cause }

var (
    ErrCacheNotFound     = &CacheError{Code: "cache_not_found", Message: "cache: not found"}
    ErrCacheInvalidInput = &CacheError{Code: "cache_invalid_input", Message: "cache: invalid input"}
    ErrCacheConflict     = &CacheError{Code: "cache_conflict", Message: "cache: conflict"}
    ErrCacheUnauthorized = &CacheError{Code: "cache_unauthorized", Message: "cache: unauthorized"}
    ErrCacheInternal     = &CacheError{Code: "cache_internal", Message: "cache: internal error"}
)

func NewCacheError(code, msg string) error { return &CacheError{Code: code, Message: msg} }
func IsCacheNotFound(err error) bool { return errors.Is(err, ErrCacheNotFound) }
