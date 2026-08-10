package environment

import (
    "fmt"
    "regexp"
    "strings"
)

type EnvironmentValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultEnvironmentValidator() *EnvironmentValidator {
    return &EnvironmentValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *EnvironmentValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrEnvironmentInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("environment: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("environment: invalid name")
    }
    return nil
}

func (v *EnvironmentValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("environment: description too long") }
    return nil
}

func (v *EnvironmentValidator) ValidateType(typ string) error {
    if typ == "" { return ErrEnvironmentInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("environment: unsupported type")
}

func (v *EnvironmentValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrEnvironmentInvalidInput }
    return nil
}

type EnvironmentValidationResult struct { Valid bool; Errors []string }

func (v *EnvironmentValidator) Validate(name, desc, typ, id string) *EnvironmentValidationResult {
    r := &EnvironmentValidationResult{}
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
