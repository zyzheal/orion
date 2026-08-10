package disasterrecovery

import (
    "fmt"
    "regexp"
    "strings"
)

type DisasterRecoveryValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultDisasterRecoveryValidator() *DisasterRecoveryValidator {
    return &DisasterRecoveryValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *DisasterRecoveryValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrDisasterRecoveryInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("disaster-recovery: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("disaster-recovery: invalid name")
    }
    return nil
}

func (v *DisasterRecoveryValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("disaster-recovery: description too long") }
    return nil
}

func (v *DisasterRecoveryValidator) ValidateType(typ string) error {
    if typ == "" { return ErrDisasterRecoveryInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("disaster-recovery: unsupported type")
}

func (v *DisasterRecoveryValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrDisasterRecoveryInvalidInput }
    return nil
}

type DisasterRecoveryValidationResult struct { Valid bool; Errors []string }

func (v *DisasterRecoveryValidator) Validate(name, desc, typ, id string) *DisasterRecoveryValidationResult {
    r := &DisasterRecoveryValidationResult{}
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
