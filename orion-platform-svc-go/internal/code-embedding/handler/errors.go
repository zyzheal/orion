package handler

import "errors"

type CodeEmbeddingError struct { Code string; Message string; Cause error }

func (e *CodeEmbeddingError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *CodeEmbeddingError) Is(target error) bool { _, ok := target.(*CodeEmbeddingError); return ok }
func (e *CodeEmbeddingError) Unwrap() error { return e.Cause }

var (
    ErrCodeEmbeddingNotFound     = &CodeEmbeddingError{Code: "codeembedding_not_found", Message: "code-embedding: not found"}
    ErrCodeEmbeddingInvalidInput = &CodeEmbeddingError{Code: "codeembedding_invalid_input", Message: "code-embedding: invalid input"}
    ErrCodeEmbeddingConflict     = &CodeEmbeddingError{Code: "codeembedding_conflict", Message: "code-embedding: conflict"}
    ErrCodeEmbeddingUnauthorized = &CodeEmbeddingError{Code: "codeembedding_unauthorized", Message: "code-embedding: unauthorized"}
    ErrCodeEmbeddingInternal     = &CodeEmbeddingError{Code: "codeembedding_internal", Message: "code-embedding: internal error"}
)

func NewCodeEmbeddingError(code, msg string) error { return &CodeEmbeddingError{Code: code, Message: msg} }
func IsCodeEmbeddingNotFound(err error) bool { return errors.Is(err, ErrCodeEmbeddingNotFound) }
