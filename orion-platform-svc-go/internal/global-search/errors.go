package globalsearch

import "errors"

type GlobalSearchError struct { Code string; Message string; Cause error }

func (e *GlobalSearchError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *GlobalSearchError) Is(target error) bool { _, ok := target.(*GlobalSearchError); return ok }
func (e *GlobalSearchError) Unwrap() error { return e.Cause }

var (
    ErrGlobalSearchNotFound     = &GlobalSearchError{Code: "globalsearch_not_found", Message: "global-search: not found"}
    ErrGlobalSearchInvalidInput = &GlobalSearchError{Code: "globalsearch_invalid_input", Message: "global-search: invalid input"}
    ErrGlobalSearchConflict     = &GlobalSearchError{Code: "globalsearch_conflict", Message: "global-search: conflict"}
    ErrGlobalSearchUnauthorized = &GlobalSearchError{Code: "globalsearch_unauthorized", Message: "global-search: unauthorized"}
    ErrGlobalSearchInternal     = &GlobalSearchError{Code: "globalsearch_internal", Message: "global-search: internal error"}
)

func NewGlobalSearchError(code, msg string) error { return &GlobalSearchError{Code: code, Message: msg} }
func IsGlobalSearchNotFound(err error) bool { return errors.Is(err, ErrGlobalSearchNotFound) }
