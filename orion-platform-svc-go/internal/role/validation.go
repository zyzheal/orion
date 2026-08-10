package role

import (
    "fmt"
    "regexp"
    "strings"
)

type RoleValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultRoleValidator() *RoleValidator {
    return &RoleValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *RoleValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrRoleInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("role: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("role: invalid name")
    }
    return nil
}

func (v *RoleValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("role: description too long") }
    return nil
}

func (v *RoleValidator) ValidateType(typ string) error {
    if typ == "" { return ErrRoleInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("role: unsupported type")
}

func (v *RoleValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrRoleInvalidInput }
    return nil
}

type RoleValidationResult struct { Valid bool; Errors []string }

func (v *RoleValidator) Validate(name, desc, typ, id string) *RoleValidationResult {
    r := &RoleValidationResult{}
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
