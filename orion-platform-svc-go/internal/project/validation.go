package project

import (
    "fmt"
    "regexp"
    "strings"
)

type ProjectValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultProjectValidator() *ProjectValidator {
    return &ProjectValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ProjectValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrProjectInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("project: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("project: invalid name")
    }
    return nil
}

func (v *ProjectValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("project: description too long") }
    return nil
}

func (v *ProjectValidator) ValidateType(typ string) error {
    if typ == "" { return ErrProjectInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("project: unsupported type")
}

func (v *ProjectValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrProjectInvalidInput }
    return nil
}

type ProjectValidationResult struct { Valid bool; Errors []string }

func (v *ProjectValidator) Validate(name, desc, typ, id string) *ProjectValidationResult {
    r := &ProjectValidationResult{}
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
