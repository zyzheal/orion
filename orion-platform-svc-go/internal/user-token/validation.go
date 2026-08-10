package usertoken

import (
    "fmt"
    "regexp"
    "strings"
)

type UserTokenValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultUserTokenValidator() *UserTokenValidator {
    return &UserTokenValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *UserTokenValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrUserTokenInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("user-token: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("user-token: invalid name")
    }
    return nil
}

func (v *UserTokenValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("user-token: description too long") }
    return nil
}

func (v *UserTokenValidator) ValidateType(typ string) error {
    if typ == "" { return ErrUserTokenInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("user-token: unsupported type")
}

func (v *UserTokenValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrUserTokenInvalidInput }
    return nil
}

type UserTokenValidationResult struct { Valid bool; Errors []string }

func (v *UserTokenValidator) Validate(name, desc, typ, id string) *UserTokenValidationResult {
    r := &UserTokenValidationResult{}
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
