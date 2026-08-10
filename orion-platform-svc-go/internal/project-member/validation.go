package projectmember

import (
    "fmt"
    "regexp"
    "strings"
)

type ProjectMemberValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultProjectMemberValidator() *ProjectMemberValidator {
    return &ProjectMemberValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ProjectMemberValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrProjectMemberInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("project-member: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("project-member: invalid name")
    }
    return nil
}

func (v *ProjectMemberValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("project-member: description too long") }
    return nil
}

func (v *ProjectMemberValidator) ValidateType(typ string) error {
    if typ == "" { return ErrProjectMemberInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("project-member: unsupported type")
}

func (v *ProjectMemberValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrProjectMemberInvalidInput }
    return nil
}

type ProjectMemberValidationResult struct { Valid bool; Errors []string }

func (v *ProjectMemberValidator) Validate(name, desc, typ, id string) *ProjectMemberValidationResult {
    r := &ProjectMemberValidationResult{}
    checks := []struct{ field string; fn func() error }{
        {"name", func() error { return v.ValidateName(name) } },
        {"description", func() error { return v.ValidateDescription(desc) } },
        {"type", func() error { return v.ValidateType(typ) } },
        {"id", func() error { return v.ValidateID(id) } },
    }
    for _, c := range checks {
        if err := c.fn(); err != nil { r.Errors = append(r.Errors, c.field+": "+err.Error()) }
    }
    r.Valid = len(r.Errors) == 0
    return r
}
