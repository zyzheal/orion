package projectmember

import "errors"

type ProjectMemberError struct { Code string; Message string; Cause error }

func (e *ProjectMemberError) Error() string {
    if e.Cause != nil { return e.Message + ": " + e.Cause.Error() }
    return e.Message
}

func (e *ProjectMemberError) Is(target error) bool { _, ok := target.(*ProjectMemberError); return ok }
func (e *ProjectMemberError) Unwrap() error { return e.Cause }

var (
    ErrProjectMemberNotFound     = &ProjectMemberError{Code: "projectmember_not_found", Message: "project-member: not found"}
    ErrProjectMemberInvalidInput = &ProjectMemberError{Code: "projectmember_invalid_input", Message: "project-member: invalid input"}
    ErrProjectMemberConflict     = &ProjectMemberError{Code: "projectmember_conflict", Message: "project-member: conflict"}
    ErrProjectMemberUnauthorized = &ProjectMemberError{Code: "projectmember_unauthorized", Message: "project-member: unauthorized"}
    ErrProjectMemberInternal     = &ProjectMemberError{Code: "projectmember_internal", Message: "project-member: internal error"}
)

func NewProjectMemberError(code, msg string) error { return &ProjectMemberError{Code: code, Message: msg} }
func IsProjectMemberNotFound(err error) bool { return errors.Is(err, ErrProjectMemberNotFound) }
