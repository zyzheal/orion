package visor

import (
    "fmt"
    "regexp"
    "strings"
)

type VisorValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultVisorValidator() *VisorValidator {
    return &VisorValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *VisorValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrVisorInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("visor: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("visor: invalid name")
    }
    return nil
}

func (v *VisorValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("visor: description too long") }
    return nil
}

func (v *VisorValidator) ValidateType(typ string) error {
    if typ == "" { return ErrVisorInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("visor: unsupported type")
}

func (v *VisorValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrVisorInvalidInput }
    return nil
}

type VisorValidationResult struct { Valid bool; Errors []string }

func (v *VisorValidator) Validate(name, desc, typ, id string) *VisorValidationResult {
    r := &VisorValidationResult{}
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
