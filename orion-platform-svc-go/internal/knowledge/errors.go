package knowledge

import "errors"

// KnowledgeError represents domain errors for the knowledge module.
type KnowledgeError struct {
    Code    string
    Message string
    Cause   error
}

func (e *KnowledgeError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *KnowledgeError) Is(target error) bool {
    _, ok := target.(*KnowledgeError)
    return ok
}

func (e *KnowledgeError) Unwrap() error {
    return e.Cause
}

var (
    ErrKnowledgeNotFound     = &KnowledgeError{Code: "knowledge_not_found", Message: "knowledge: resource not found"}
    ErrKnowledgeInvalidInput = &KnowledgeError{Code: "knowledge_invalid_input", Message: "knowledge: invalid input"}
    ErrKnowledgeConflict     = &KnowledgeError{Code: "knowledge_conflict", Message: "knowledge: resource conflict"}
    ErrKnowledgeUnauthorized = &KnowledgeError{Code: "knowledge_unauthorized", Message: "knowledge: unauthorized access"}
    ErrKnowledgeInternal     = &KnowledgeError{Code: "knowledge_internal", Message: "knowledge: internal error"}
)

func NewKnowledgeError(code, message string) error {
    return &KnowledgeError{Code: code, Message: message}
}

func IsKnowledgeNotFound(err error) bool {
    return errors.Is(err, ErrKnowledgeNotFound)
}
