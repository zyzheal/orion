package permission

import (
    "fmt"
    "regexp"
    "strings"
)

type PermissionValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultPermissionValidator() *PermissionValidator {
    return &PermissionValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *PermissionValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrPermissionInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("permission: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("permission: invalid name")
    }
    return nil
}

func (v *PermissionValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("permission: description too long") }
    return nil
}

func (v *PermissionValidator) ValidateType(typ string) error {
    if typ == "" { return ErrPermissionInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("permission: unsupported type")
}

func (v *PermissionValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrPermissionInvalidInput }
    return nil
}

type PermissionValidationResult struct { Valid bool; Errors []string }

func (v *PermissionValidator) Validate(name, desc, typ, id string) *PermissionValidationResult {
    r := &PermissionValidationResult{}
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
