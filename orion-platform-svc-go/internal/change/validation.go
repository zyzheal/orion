package change

import (
    "fmt"
    "regexp"
    "strings"
)

type ChangeValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultChangeValidator() *ChangeValidator {
    return &ChangeValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ChangeValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrChangeInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("change: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("change: invalid name characters")
    }
    return nil
}

func (v *ChangeValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("change: description too long") }
    return nil
}

func (v *ChangeValidator) ValidateType(typ string) error {
    if typ == "" { return ErrChangeInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("change: unsupported type")
}

func (v *ChangeValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrChangeInvalidInput }
    return nil
}

type ChangeValidationResult struct { Valid bool; Errors []string }

func (v *ChangeValidator) Validate(name, desc, typ, id string) *ChangeValidationResult {
    r := &ChangeValidationResult{}
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
