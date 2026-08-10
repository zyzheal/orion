package coderepo

import "errors"

// CodeRepoError represents domain errors for the code-repo module.
type CodeRepoError struct {
    Code    string
    Message string
    Cause   error
}

func (e *CodeRepoError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *CodeRepoError) Is(target error) bool {
    _, ok := target.(*CodeRepoError)
    return ok
}

func (e *CodeRepoError) Unwrap() error {
    return e.Cause
}

var (
    ErrCodeRepoNotFound     = &CodeRepoError{Code: "coderepo_not_found", Message: "code-repo: resource not found"}
    ErrCodeRepoInvalidInput = &CodeRepoError{Code: "coderepo_invalid_input", Message: "code-repo: invalid input"}
    ErrCodeRepoConflict     = &CodeRepoError{Code: "coderepo_conflict", Message: "code-repo: resource conflict"}
    ErrCodeRepoUnauthorized = &CodeRepoError{Code: "coderepo_unauthorized", Message: "code-repo: unauthorized access"}
    ErrCodeRepoInternal     = &CodeRepoError{Code: "coderepo_internal", Message: "code-repo: internal error"}
)

func NewCodeRepoError(code, message string) error {
    return &CodeRepoError{Code: code, Message: message}
}

func IsCodeRepoNotFound(err error) bool {
    return errors.Is(err, ErrCodeRepoNotFound)
}
