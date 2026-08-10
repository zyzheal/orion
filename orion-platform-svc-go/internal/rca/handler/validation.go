package handler

import (
    "fmt"
    "regexp"
    "strings"
)

type RcaValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultRcaValidator() *RcaValidator {
    return &RcaValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *RcaValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrRcaInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("rca: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("rca: invalid name")
    }
    return nil
}

func (v *RcaValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("rca: description too long") }
    return nil
}

func (v *RcaValidator) ValidateType(typ string) error {
    if typ == "" { return ErrRcaInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("rca: unsupported type")
}

func (v *RcaValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrRcaInvalidInput }
    return nil
}

type RcaValidationResult struct { Valid bool; Errors []string }

func (v *RcaValidator) Validate(name, desc, typ, id string) *RcaValidationResult {
    r := &RcaValidationResult{}
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
