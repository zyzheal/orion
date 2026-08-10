package ueba

import (
    "fmt"
    "regexp"
    "strings"
)

type UebaValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultUebaValidator() *UebaValidator {
    return &UebaValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *UebaValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrUebaInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("ueba: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("ueba: invalid name")
    }
    return nil
}

func (v *UebaValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("ueba: description too long") }
    return nil
}

func (v *UebaValidator) ValidateType(typ string) error {
    if typ == "" { return ErrUebaInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("ueba: unsupported type")
}

func (v *UebaValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrUebaInvalidInput }
    return nil
}

type UebaValidationResult struct { Valid bool; Errors []string }

func (v *UebaValidator) Validate(name, desc, typ, id string) *UebaValidationResult {
    r := &UebaValidationResult{}
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
