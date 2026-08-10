package handler

import "errors"

type CacheMonitorError struct { Code string; Message string; Cause error }

func (e *CacheMonitorError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *CacheMonitorError) Is(target error) bool { _, ok := target.(*CacheMonitorError); return ok }
func (e *CacheMonitorError) Unwrap() error { return e.Cause }

var (
    ErrCacheMonitorNotFound     = &CacheMonitorError{Code: "cachemonitor_not_found", Message: "cache-monitor: not found"}
    ErrCacheMonitorInvalidInput = &CacheMonitorError{Code: "cachemonitor_invalid_input", Message: "cache-monitor: invalid input"}
    ErrCacheMonitorConflict     = &CacheMonitorError{Code: "cachemonitor_conflict", Message: "cache-monitor: conflict"}
    ErrCacheMonitorUnauthorized = &CacheMonitorError{Code: "cachemonitor_unauthorized", Message: "cache-monitor: unauthorized"}
    ErrCacheMonitorInternal     = &CacheMonitorError{Code: "cachemonitor_internal", Message: "cache-monitor: internal error"}
)

func NewCacheMonitorError(code, msg string) error { return &CacheMonitorError{Code: code, Message: msg} }
func IsCacheMonitorNotFound(err error) bool { return errors.Is(err, ErrCacheMonitorNotFound) }
