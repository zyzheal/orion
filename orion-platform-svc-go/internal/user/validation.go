package user

import (
    "fmt"
    "regexp"
    "strings"
)

type UserValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultUserValidator() *UserValidator {
    return &UserValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *UserValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrUserInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("user: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("user: invalid name")
    }
    return nil
}

func (v *UserValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("user: description too long") }
    return nil
}

func (v *UserValidator) ValidateType(typ string) error {
    if typ == "" { return ErrUserInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("user: unsupported type")
}

func (v *UserValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrUserInvalidInput }
    return nil
}

type UserValidationResult struct { Valid bool; Errors []string }

func (v *UserValidator) Validate(name, desc, typ, id string) *UserValidationResult {
    r := &UserValidationResult{}
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
