package community

import "errors"

type CommunityError struct { Code string; Message string; Cause error }

func (e *CommunityError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *CommunityError) Is(target error) bool { _, ok := target.(*CommunityError); return ok }
func (e *CommunityError) Unwrap() error { return e.Cause }

var (
    ErrCommunityNotFound     = &CommunityError{Code: "community_not_found", Message: "community: not found"}
    ErrCommunityInvalidInput = &CommunityError{Code: "community_invalid_input", Message: "community: invalid input"}
    ErrCommunityConflict     = &CommunityError{Code: "community_conflict", Message: "community: conflict"}
    ErrCommunityUnauthorized = &CommunityError{Code: "community_unauthorized", Message: "community: unauthorized"}
    ErrCommunityInternal     = &CommunityError{Code: "community_internal", Message: "community: internal error"}
)

func NewCommunityError(code, msg string) error { return &CommunityError{Code: code, Message: msg} }
func IsCommunityNotFound(err error) bool { return errors.Is(err, ErrCommunityNotFound) }
