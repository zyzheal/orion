package useractivity

import (
    "fmt"
    "regexp"
    "strings"
)

type UserActivityValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultUserActivityValidator() *UserActivityValidator {
    return &UserActivityValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *UserActivityValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrUserActivityInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("user-activity: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("user-activity: invalid name")
    }
    return nil
}

func (v *UserActivityValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("user-activity: description too long") }
    return nil
}

func (v *UserActivityValidator) ValidateType(typ string) error {
    if typ == "" { return ErrUserActivityInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("user-activity: unsupported type")
}

func (v *UserActivityValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrUserActivityInvalidInput }
    return nil
}

type UserActivityValidationResult struct { Valid bool; Errors []string }

func (v *UserActivityValidator) Validate(name, desc, typ, id string) *UserActivityValidationResult {
    r := &UserActivityValidationResult{}
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
