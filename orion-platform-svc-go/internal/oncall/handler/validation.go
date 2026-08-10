package handler

import (
    "fmt"
    "regexp"
    "strings"
)

type OncallValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultOncallValidator() *OncallValidator {
    return &OncallValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *OncallValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrOncallInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("oncall: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("oncall: invalid name")
    }
    return nil
}

func (v *OncallValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("oncall: description too long") }
    return nil
}

func (v *OncallValidator) ValidateType(typ string) error {
    if typ == "" { return ErrOncallInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("oncall: unsupported type")
}

func (v *OncallValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrOncallInvalidInput }
    return nil
}

type OncallValidationResult struct { Valid bool; Errors []string }

func (v *OncallValidator) Validate(name, desc, typ, id string) *OncallValidationResult {
    r := &OncallValidationResult{}
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
