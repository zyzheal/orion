package ssoproviders

import (
    "fmt"
    "regexp"
    "strings"
)

type SsoProvidersValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultSsoProvidersValidator() *SsoProvidersValidator {
    return &SsoProvidersValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *SsoProvidersValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrSsoProvidersInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("sso-providers: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("sso-providers: invalid name")
    }
    return nil
}

func (v *SsoProvidersValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("sso-providers: description too long") }
    return nil
}

func (v *SsoProvidersValidator) ValidateType(typ string) error {
    if typ == "" { return ErrSsoProvidersInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("sso-providers: unsupported type")
}

func (v *SsoProvidersValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrSsoProvidersInvalidInput }
    return nil
}

type SsoProvidersValidationResult struct { Valid bool; Errors []string }

func (v *SsoProvidersValidator) Validate(name, desc, typ, id string) *SsoProvidersValidationResult {
    r := &SsoProvidersValidationResult{}
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
