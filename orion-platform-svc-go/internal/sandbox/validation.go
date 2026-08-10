package sandbox

import (
    "fmt"
    "regexp"
    "strings"
)

type SandboxValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultSandboxValidator() *SandboxValidator {
    return &SandboxValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *SandboxValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrSandboxInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("sandbox: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("sandbox: invalid name")
    }
    return nil
}

func (v *SandboxValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("sandbox: description too long") }
    return nil
}

func (v *SandboxValidator) ValidateType(typ string) error {
    if typ == "" { return ErrSandboxInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("sandbox: unsupported type")
}

func (v *SandboxValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrSandboxInvalidInput }
    return nil
}

type SandboxValidationResult struct { Valid bool; Errors []string }

func (v *SandboxValidator) Validate(name, desc, typ, id string) *SandboxValidationResult {
    r := &SandboxValidationResult{}
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
