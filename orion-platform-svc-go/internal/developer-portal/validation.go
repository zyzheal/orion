package developerportal

import (
    "fmt"
    "regexp"
    "strings"
)

type DeveloperPortalValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultDeveloperPortalValidator() *DeveloperPortalValidator {
    return &DeveloperPortalValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *DeveloperPortalValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrDeveloperPortalInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("developer-portal: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("developer-portal: invalid name characters")
    }
    return nil
}

func (v *DeveloperPortalValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("developer-portal: description too long") }
    return nil
}

func (v *DeveloperPortalValidator) ValidateType(typ string) error {
    if typ == "" { return ErrDeveloperPortalInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("developer-portal: unsupported type")
}

func (v *DeveloperPortalValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrDeveloperPortalInvalidInput }
    return nil
}

type DeveloperPortalValidationResult struct { Valid bool; Errors []string }

func (v *DeveloperPortalValidator) Validate(name, desc, typ, id string) *DeveloperPortalValidationResult {
    r := &DeveloperPortalValidationResult{}
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
