package abacpolicy

import "errors"

type AbacPolicyError struct { Code string; Message string; Cause error }

func (e *AbacPolicyError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *AbacPolicyError) Is(target error) bool { _, ok := target.(*AbacPolicyError); return ok }
func (e *AbacPolicyError) Unwrap() error { return e.Cause }

var (
    ErrAbacPolicyNotFound     = &AbacPolicyError{Code: "abacpolicy_not_found", Message: "abac-policy: not found"}
    ErrAbacPolicyInvalidInput = &AbacPolicyError{Code: "abacpolicy_invalid_input", Message: "abac-policy: invalid input"}
    ErrAbacPolicyConflict     = &AbacPolicyError{Code: "abacpolicy_conflict", Message: "abac-policy: conflict"}
    ErrAbacPolicyUnauthorized = &AbacPolicyError{Code: "abacpolicy_unauthorized", Message: "abac-policy: unauthorized"}
    ErrAbacPolicyInternal     = &AbacPolicyError{Code: "abacpolicy_internal", Message: "abac-policy: internal error"}
)

func NewAbacPolicyError(code, msg string) error { return &AbacPolicyError{Code: code, Message: msg} }
func IsAbacPolicyNotFound(err error) bool { return errors.Is(err, ErrAbacPolicyNotFound) }
