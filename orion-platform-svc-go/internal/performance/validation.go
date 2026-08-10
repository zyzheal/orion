package performance

import (
    "fmt"
    "regexp"
    "strings"
)

type PerformanceValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultPerformanceValidator() *PerformanceValidator {
    return &PerformanceValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *PerformanceValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrPerformanceInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("performance: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("performance: invalid name")
    }
    return nil
}

func (v *PerformanceValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("performance: description too long") }
    return nil
}

func (v *PerformanceValidator) ValidateType(typ string) error {
    if typ == "" { return ErrPerformanceInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("performance: unsupported type")
}

func (v *PerformanceValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrPerformanceInvalidInput }
    return nil
}

type PerformanceValidationResult struct { Valid bool; Errors []string }

func (v *PerformanceValidator) Validate(name, desc, typ, id string) *PerformanceValidationResult {
    r := &PerformanceValidationResult{}
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
