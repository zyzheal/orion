package userstatus

import (
    "fmt"
    "regexp"
    "strings"
)

type UserStatusValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultUserStatusValidator() *UserStatusValidator {
    return &UserStatusValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *UserStatusValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrUserStatusInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("user-status: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("user-status: invalid name")
    }
    return nil
}

func (v *UserStatusValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("user-status: description too long") }
    return nil
}

func (v *UserStatusValidator) ValidateType(typ string) error {
    if typ == "" { return ErrUserStatusInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("user-status: unsupported type")
}

func (v *UserStatusValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrUserStatusInvalidInput }
    return nil
}

type UserStatusValidationResult struct { Valid bool; Errors []string }

func (v *UserStatusValidator) Validate(name, desc, typ, id string) *UserStatusValidationResult {
    r := &UserStatusValidationResult{}
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
