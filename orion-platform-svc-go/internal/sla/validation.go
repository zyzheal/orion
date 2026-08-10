package sla

import (
    "fmt"
    "regexp"
    "strings"
)

type SlaValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultSlaValidator() *SlaValidator {
    return &SlaValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *SlaValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrSlaInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("sla: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("sla: invalid name characters")
    }
    return nil
}

func (v *SlaValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("sla: description too long") }
    return nil
}

func (v *SlaValidator) ValidateType(typ string) error {
    if typ == "" { return ErrSlaInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("sla: unsupported type")
}

func (v *SlaValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrSlaInvalidInput }
    return nil
}

type SlaValidationResult struct { Valid bool; Errors []string }

func (v *SlaValidator) Validate(name, desc, typ, id string) *SlaValidationResult {
    r := &SlaValidationResult{}
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
