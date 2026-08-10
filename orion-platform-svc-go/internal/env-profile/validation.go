package envprofile

import (
    "fmt"
    "regexp"
    "strings"
)

type EnvProfileValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultEnvProfileValidator() *EnvProfileValidator {
    return &EnvProfileValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *EnvProfileValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrEnvProfileInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("env-profile: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("env-profile: invalid name")
    }
    return nil
}

func (v *EnvProfileValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("env-profile: description too long") }
    return nil
}

func (v *EnvProfileValidator) ValidateType(typ string) error {
    if typ == "" { return ErrEnvProfileInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("env-profile: unsupported type")
}

func (v *EnvProfileValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrEnvProfileInvalidInput }
    return nil
}

type EnvProfileValidationResult struct { Valid bool; Errors []string }

func (v *EnvProfileValidator) Validate(name, desc, typ, id string) *EnvProfileValidationResult {
    r := &EnvProfileValidationResult{}
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
