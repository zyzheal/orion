package communityadvanced

import "errors"

type CommunityAdvancedError struct { Code string; Message string; Cause error }

func (e *CommunityAdvancedError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *CommunityAdvancedError) Is(target error) bool { _, ok := target.(*CommunityAdvancedError); return ok }
func (e *CommunityAdvancedError) Unwrap() error { return e.Cause }

var (
    ErrCommunityAdvancedNotFound     = &CommunityAdvancedError{Code: "communityadvanced_not_found", Message: "community-advanced: not found"}
    ErrCommunityAdvancedInvalidInput = &CommunityAdvancedError{Code: "communityadvanced_invalid_input", Message: "community-advanced: invalid input"}
    ErrCommunityAdvancedConflict     = &CommunityAdvancedError{Code: "communityadvanced_conflict", Message: "community-advanced: conflict"}
    ErrCommunityAdvancedUnauthorized = &CommunityAdvancedError{Code: "communityadvanced_unauthorized", Message: "community-advanced: unauthorized"}
    ErrCommunityAdvancedInternal     = &CommunityAdvancedError{Code: "communityadvanced_internal", Message: "community-advanced: internal error"}
)

func NewCommunityAdvancedError(code, msg string) error { return &CommunityAdvancedError{Code: code, Message: msg} }
func IsCommunityAdvancedNotFound(err error) bool { return errors.Is(err, ErrCommunityAdvancedNotFound) }
