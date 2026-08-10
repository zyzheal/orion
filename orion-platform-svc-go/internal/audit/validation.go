package audit

import (
    "fmt"
    "regexp"
    "strings"
)

type AuditValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultAuditValidator() *AuditValidator {
    return &AuditValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *AuditValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrAuditInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("audit: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("audit: invalid name characters")
    }
    return nil
}

func (v *AuditValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("audit: description too long") }
    return nil
}

func (v *AuditValidator) ValidateType(typ string) error {
    if typ == "" { return ErrAuditInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("audit: unsupported type")
}

func (v *AuditValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrAuditInvalidInput }
    return nil
}

type AuditValidationResult struct { Valid bool; Errors []string }

func (v *AuditValidator) Validate(name, desc, typ, id string) *AuditValidationResult {
    r := &AuditValidationResult{}
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
