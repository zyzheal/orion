package featureflag

import (
    "fmt"
    "regexp"
    "strings"
)

type FeatureFlagValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultFeatureFlagValidator() *FeatureFlagValidator {
    return &FeatureFlagValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *FeatureFlagValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrFeatureFlagInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("feature-flag: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("feature-flag: invalid name characters")
    }
    return nil
}

func (v *FeatureFlagValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("feature-flag: description too long") }
    return nil
}

func (v *FeatureFlagValidator) ValidateType(typ string) error {
    if typ == "" { return ErrFeatureFlagInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("feature-flag: unsupported type")
}

func (v *FeatureFlagValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrFeatureFlagInvalidInput }
    return nil
}

type FeatureFlagValidationResult struct { Valid bool; Errors []string }

func (v *FeatureFlagValidator) Validate(name, desc, typ, id string) *FeatureFlagValidationResult {
    r := &FeatureFlagValidationResult{}
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
