package observability

import (
    "fmt"
    "regexp"
    "strings"
)

type ObservabilityValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultObservabilityValidator() *ObservabilityValidator {
    return &ObservabilityValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ObservabilityValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrObservabilityInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("observability: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("observability: invalid name")
    }
    return nil
}

func (v *ObservabilityValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("observability: description too long") }
    return nil
}

func (v *ObservabilityValidator) ValidateType(typ string) error {
    if typ == "" { return ErrObservabilityInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("observability: unsupported type")
}

func (v *ObservabilityValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrObservabilityInvalidInput }
    return nil
}

type ObservabilityValidationResult struct { Valid bool; Errors []string }

func (v *ObservabilityValidator) Validate(name, desc, typ, id string) *ObservabilityValidationResult {
    r := &ObservabilityValidationResult{}
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
