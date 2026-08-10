package unifiedconfig

import (
    "fmt"
    "regexp"
    "strings"
)

type UnifiedConfigValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultUnifiedConfigValidator() *UnifiedConfigValidator {
    return &UnifiedConfigValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *UnifiedConfigValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrUnifiedConfigInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("unified-config: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("unified-config: invalid name")
    }
    return nil
}

func (v *UnifiedConfigValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("unified-config: description too long") }
    return nil
}

func (v *UnifiedConfigValidator) ValidateType(typ string) error {
    if typ == "" { return ErrUnifiedConfigInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("unified-config: unsupported type")
}

func (v *UnifiedConfigValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrUnifiedConfigInvalidInput }
    return nil
}

type UnifiedConfigValidationResult struct { Valid bool; Errors []string }

func (v *UnifiedConfigValidator) Validate(name, desc, typ, id string) *UnifiedConfigValidationResult {
    r := &UnifiedConfigValidationResult{}
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
