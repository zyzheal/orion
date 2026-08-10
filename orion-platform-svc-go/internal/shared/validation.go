package shared

import (
    "fmt"
    "regexp"
    "strings"
)

type SharedValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultSharedValidator() *SharedValidator {
    return &SharedValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *SharedValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrSharedInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("shared: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("shared: invalid name characters")
    }
    return nil
}

func (v *SharedValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("shared: description too long") }
    return nil
}

func (v *SharedValidator) ValidateType(typ string) error {
    if typ == "" { return ErrSharedInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("shared: unsupported type")
}

func (v *SharedValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrSharedInvalidInput }
    return nil
}

type SharedValidationResult struct { Valid bool; Errors []string }

func (v *SharedValidator) Validate(name, desc, typ, id string) *SharedValidationResult {
    r := &SharedValidationResult{}
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
