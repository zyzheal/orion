package service

import "errors"

// CmdbRelationshipError represents domain errors for the cmdb-relationship module.
type CmdbRelationshipError struct {
    Code    string
    Message string
    Cause   error
}

func (e *CmdbRelationshipError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *CmdbRelationshipError) Is(target error) bool {
    _, ok := target.(*CmdbRelationshipError)
    return ok
}

func (e *CmdbRelationshipError) Unwrap() error {
    return e.Cause
}

var (
    ErrCmdbRelationshipNotFound     = &CmdbRelationshipError{Code: "cmdbrelationship_not_found", Message: "cmdb-relationship: resource not found"}
    ErrCmdbRelationshipInvalidInput = &CmdbRelationshipError{Code: "cmdbrelationship_invalid_input", Message: "cmdb-relationship: invalid input"}
    ErrCmdbRelationshipConflict     = &CmdbRelationshipError{Code: "cmdbrelationship_conflict", Message: "cmdb-relationship: resource conflict"}
    ErrCmdbRelationshipUnauthorized = &CmdbRelationshipError{Code: "cmdbrelationship_unauthorized", Message: "cmdb-relationship: unauthorized access"}
    ErrCmdbRelationshipInternal     = &CmdbRelationshipError{Code: "cmdbrelationship_internal", Message: "cmdb-relationship: internal error"}
)

func NewCmdbRelationshipError(code, message string) error {
    return &CmdbRelationshipError{Code: code, Message: message}
}

func IsCmdbRelationshipNotFound(err error) bool {
    return errors.Is(err, ErrCmdbRelationshipNotFound)
}
