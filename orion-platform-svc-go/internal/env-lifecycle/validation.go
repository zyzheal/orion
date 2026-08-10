package envlifecycle

import (
    "fmt"
    "regexp"
    "strings"
)

type EnvLifecycleValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultEnvLifecycleValidator() *EnvLifecycleValidator {
    return &EnvLifecycleValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *EnvLifecycleValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrEnvLifecycleInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("env-lifecycle: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("env-lifecycle: invalid name")
    }
    return nil
}

func (v *EnvLifecycleValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("env-lifecycle: description too long") }
    return nil
}

func (v *EnvLifecycleValidator) ValidateType(typ string) error {
    if typ == "" { return ErrEnvLifecycleInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("env-lifecycle: unsupported type")
}

func (v *EnvLifecycleValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrEnvLifecycleInvalidInput }
    return nil
}

type EnvLifecycleValidationResult struct { Valid bool; Errors []string }

func (v *EnvLifecycleValidator) Validate(name, desc, typ, id string) *EnvLifecycleValidationResult {
    r := &EnvLifecycleValidationResult{}
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
