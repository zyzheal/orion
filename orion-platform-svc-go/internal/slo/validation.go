package slo

import (
    "fmt"
    "regexp"
    "strings"
)

type SloValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultSloValidator() *SloValidator {
    return &SloValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *SloValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrSloInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("slo: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("slo: invalid name")
    }
    return nil
}

func (v *SloValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("slo: description too long") }
    return nil
}

func (v *SloValidator) ValidateType(typ string) error {
    if typ == "" { return ErrSloInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("slo: unsupported type")
}

func (v *SloValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrSloInvalidInput }
    return nil
}

type SloValidationResult struct { Valid bool; Errors []string }

func (v *SloValidator) Validate(name, desc, typ, id string) *SloValidationResult {
    r := &SloValidationResult{}
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
