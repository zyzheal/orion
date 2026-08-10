package userprofile

import (
    "fmt"
    "regexp"
    "strings"
)

type UserProfileValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultUserProfileValidator() *UserProfileValidator {
    return &UserProfileValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *UserProfileValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrUserProfileInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("user-profile: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("user-profile: invalid name")
    }
    return nil
}

func (v *UserProfileValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("user-profile: description too long") }
    return nil
}

func (v *UserProfileValidator) ValidateType(typ string) error {
    if typ == "" { return ErrUserProfileInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("user-profile: unsupported type")
}

func (v *UserProfileValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrUserProfileInvalidInput }
    return nil
}

type UserProfileValidationResult struct { Valid bool; Errors []string }

func (v *UserProfileValidator) Validate(name, desc, typ, id string) *UserProfileValidationResult {
    r := &UserProfileValidationResult{}
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
