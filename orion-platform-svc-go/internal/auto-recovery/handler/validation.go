package handler

import (
    "fmt"
    "regexp"
    "strings"
)

type AutoRecoveryValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultAutoRecoveryValidator() *AutoRecoveryValidator {
    return &AutoRecoveryValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *AutoRecoveryValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrAutoRecoveryInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("auto-recovery: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("auto-recovery: invalid name")
    }
    return nil
}

func (v *AutoRecoveryValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("auto-recovery: description too long") }
    return nil
}

func (v *AutoRecoveryValidator) ValidateType(typ string) error {
    if typ == "" { return ErrAutoRecoveryInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("auto-recovery: unsupported type")
}

func (v *AutoRecoveryValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrAutoRecoveryInvalidInput }
    return nil
}

type AutoRecoveryValidationResult struct { Valid bool; Errors []string }

func (v *AutoRecoveryValidator) Validate(name, desc, typ, id string) *AutoRecoveryValidationResult {
    r := &AutoRecoveryValidationResult{}
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
