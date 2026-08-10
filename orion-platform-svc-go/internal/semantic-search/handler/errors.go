package handler

import "errors"

type SemanticSearchError struct { Code string; Message string; Cause error }

func (e *SemanticSearchError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *SemanticSearchError) Is(target error) bool { _, ok := target.(*SemanticSearchError); return ok }
func (e *SemanticSearchError) Unwrap() error { return e.Cause }

var (
    ErrSemanticSearchNotFound     = &SemanticSearchError{Code: "semanticsearch_not_found", Message: "semantic-search: not found"}
    ErrSemanticSearchInvalidInput = &SemanticSearchError{Code: "semanticsearch_invalid_input", Message: "semantic-search: invalid input"}
    ErrSemanticSearchConflict     = &SemanticSearchError{Code: "semanticsearch_conflict", Message: "semantic-search: conflict"}
    ErrSemanticSearchUnauthorized = &SemanticSearchError{Code: "semanticsearch_unauthorized", Message: "semantic-search: unauthorized"}
    ErrSemanticSearchInternal     = &SemanticSearchError{Code: "semanticsearch_internal", Message: "semantic-search: internal error"}
)

func NewSemanticSearchError(code, msg string) error { return &SemanticSearchError{Code: code, Message: msg} }
func IsSemanticSearchNotFound(err error) bool { return errors.Is(err, ErrSemanticSearchNotFound) }
