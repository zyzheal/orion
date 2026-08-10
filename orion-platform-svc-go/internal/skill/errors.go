package skill

import "errors"

// SkillError represents domain errors for the skill module.
type SkillError struct {
    Code    string
    Message string
    Cause   error
}

func (e *SkillError) Error() string {
    if e.Cause != nil {
        return e.Message + ": " + e.Cause.Error()
    }
    return e.Message
}

func (e *SkillError) Is(target error) bool {
    _, ok := target.(*SkillError)
    return ok
}

func (e *SkillError) Unwrap() error {
    return e.Cause
}

var (
    ErrSkillNotFound     = &SkillError{Code: "skill_not_found", Message: "skill: resource not found"}
    ErrSkillInvalidInput = &SkillError{Code: "skill_invalid_input", Message: "skill: invalid input"}
    ErrSkillConflict     = &SkillError{Code: "skill_conflict", Message: "skill: resource conflict"}
    ErrSkillUnauthorized = &SkillError{Code: "skill_unauthorized", Message: "skill: unauthorized access"}
    ErrSkillInternal     = &SkillError{Code: "skill_internal", Message: "skill: internal error"}
)

func NewSkillError(code, message string) error {
    return &SkillError{Code: code, Message: message}
}

func IsSkillNotFound(err error) bool {
    return errors.Is(err, ErrSkillNotFound)
}
