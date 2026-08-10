package donotdisturb

import (
    "fmt"
    "regexp"
    "strings"
)

type DoNotDisturbValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultDoNotDisturbValidator() *DoNotDisturbValidator {
    return &DoNotDisturbValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *DoNotDisturbValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrDoNotDisturbInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("do-not-disturb: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("do-not-disturb: invalid name")
    }
    return nil
}

func (v *DoNotDisturbValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("do-not-disturb: description too long") }
    return nil
}

func (v *DoNotDisturbValidator) ValidateType(typ string) error {
    if typ == "" { return ErrDoNotDisturbInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("do-not-disturb: unsupported type")
}

func (v *DoNotDisturbValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrDoNotDisturbInvalidInput }
    return nil
}

type DoNotDisturbValidationResult struct { Valid bool; Errors []string }

func (v *DoNotDisturbValidator) Validate(name, desc, typ, id string) *DoNotDisturbValidationResult {
    r := &DoNotDisturbValidationResult{}
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
