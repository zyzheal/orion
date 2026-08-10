package privacy

import (
    "fmt"
    "regexp"
    "strings"
)

type PrivacyValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultPrivacyValidator() *PrivacyValidator {
    return &PrivacyValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *PrivacyValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrPrivacyInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("privacy: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("privacy: invalid name")
    }
    return nil
}

func (v *PrivacyValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("privacy: description too long") }
    return nil
}

func (v *PrivacyValidator) ValidateType(typ string) error {
    if typ == "" { return ErrPrivacyInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("privacy: unsupported type")
}

func (v *PrivacyValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrPrivacyInvalidInput }
    return nil
}

type PrivacyValidationResult struct { Valid bool; Errors []string }

func (v *PrivacyValidator) Validate(name, desc, typ, id string) *PrivacyValidationResult {
    r := &PrivacyValidationResult{}
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
