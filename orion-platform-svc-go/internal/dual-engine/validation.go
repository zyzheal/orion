package dualengine

import (
    "fmt"
    "regexp"
    "strings"
)

type DualEngineValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultDualEngineValidator() *DualEngineValidator {
    return &DualEngineValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *DualEngineValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrDualEngineInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("dual-engine: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("dual-engine: invalid name")
    }
    return nil
}

func (v *DualEngineValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("dual-engine: description too long") }
    return nil
}

func (v *DualEngineValidator) ValidateType(typ string) error {
    if typ == "" { return ErrDualEngineInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("dual-engine: unsupported type")
}

func (v *DualEngineValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrDualEngineInvalidInput }
    return nil
}

type DualEngineValidationResult struct { Valid bool; Errors []string }

func (v *DualEngineValidator) Validate(name, desc, typ, id string) *DualEngineValidationResult {
    r := &DualEngineValidationResult{}
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
