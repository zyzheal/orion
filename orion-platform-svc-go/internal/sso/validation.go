package sso

import (
    "fmt"
    "regexp"
    "strings"
)

type SsoValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultSsoValidator() *SsoValidator {
    return &SsoValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *SsoValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrSsoInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("sso: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("sso: invalid name")
    }
    return nil
}

func (v *SsoValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("sso: description too long") }
    return nil
}

func (v *SsoValidator) ValidateType(typ string) error {
    if typ == "" { return ErrSsoInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("sso: unsupported type")
}

func (v *SsoValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrSsoInvalidInput }
    return nil
}

type SsoValidationResult struct { Valid bool; Errors []string }

func (v *SsoValidator) Validate(name, desc, typ, id string) *SsoValidationResult {
    r := &SsoValidationResult{}
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
