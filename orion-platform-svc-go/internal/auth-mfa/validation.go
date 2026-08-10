package authmfa

import (
    "fmt"
    "regexp"
    "strings"
)

type AuthMfaValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultAuthMfaValidator() *AuthMfaValidator {
    return &AuthMfaValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *AuthMfaValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrAuthMfaInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("auth-mfa: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("auth-mfa: invalid name")
    }
    return nil
}

func (v *AuthMfaValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("auth-mfa: description too long") }
    return nil
}

func (v *AuthMfaValidator) ValidateType(typ string) error {
    if typ == "" { return ErrAuthMfaInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("auth-mfa: unsupported type")
}

func (v *AuthMfaValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrAuthMfaInvalidInput }
    return nil
}

type AuthMfaValidationResult struct { Valid bool; Errors []string }

func (v *AuthMfaValidator) Validate(name, desc, typ, id string) *AuthMfaValidationResult {
    r := &AuthMfaValidationResult{}
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
