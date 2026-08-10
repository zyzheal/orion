package permissionaudit

import (
    "fmt"
    "regexp"
    "strings"
)

type PermissionAuditValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultPermissionAuditValidator() *PermissionAuditValidator {
    return &PermissionAuditValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *PermissionAuditValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrPermissionAuditInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("permission-audit: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("permission-audit: invalid name")
    }
    return nil
}

func (v *PermissionAuditValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("permission-audit: description too long") }
    return nil
}

func (v *PermissionAuditValidator) ValidateType(typ string) error {
    if typ == "" { return ErrPermissionAuditInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("permission-audit: unsupported type")
}

func (v *PermissionAuditValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrPermissionAuditInvalidInput }
    return nil
}

type PermissionAuditValidationResult struct { Valid bool; Errors []string }

func (v *PermissionAuditValidator) Validate(name, desc, typ, id string) *PermissionAuditValidationResult {
    r := &PermissionAuditValidationResult{}
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
