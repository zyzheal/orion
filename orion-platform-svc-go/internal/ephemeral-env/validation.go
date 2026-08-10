package ephemeralenv

import (
    "fmt"
    "regexp"
    "strings"
)

type EphemeralEnvValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultEphemeralEnvValidator() *EphemeralEnvValidator {
    return &EphemeralEnvValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *EphemeralEnvValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrEphemeralEnvInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("ephemeral-env: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("ephemeral-env: invalid name")
    }
    return nil
}

func (v *EphemeralEnvValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("ephemeral-env: description too long") }
    return nil
}

func (v *EphemeralEnvValidator) ValidateType(typ string) error {
    if typ == "" { return ErrEphemeralEnvInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("ephemeral-env: unsupported type")
}

func (v *EphemeralEnvValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrEphemeralEnvInvalidInput }
    return nil
}

type EphemeralEnvValidationResult struct { Valid bool; Errors []string }

func (v *EphemeralEnvValidator) Validate(name, desc, typ, id string) *EphemeralEnvValidationResult {
    r := &EphemeralEnvValidationResult{}
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
