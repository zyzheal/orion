package ssounified

import (
    "fmt"
    "regexp"
    "strings"
)

type SsoUnifiedValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultSsoUnifiedValidator() *SsoUnifiedValidator {
    return &SsoUnifiedValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *SsoUnifiedValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrSsoUnifiedInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("sso-unified: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("sso-unified: invalid name")
    }
    return nil
}

func (v *SsoUnifiedValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("sso-unified: description too long") }
    return nil
}

func (v *SsoUnifiedValidator) ValidateType(typ string) error {
    if typ == "" { return ErrSsoUnifiedInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("sso-unified: unsupported type")
}

func (v *SsoUnifiedValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrSsoUnifiedInvalidInput }
    return nil
}

type SsoUnifiedValidationResult struct { Valid bool; Errors []string }

func (v *SsoUnifiedValidator) Validate(name, desc, typ, id string) *SsoUnifiedValidationResult {
    r := &SsoUnifiedValidationResult{}
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
