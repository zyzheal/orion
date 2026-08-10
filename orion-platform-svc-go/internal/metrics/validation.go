package metrics

import (
    "fmt"
    "regexp"
    "strings"
)

type MetricsValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultMetricsValidator() *MetricsValidator {
    return &MetricsValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *MetricsValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrMetricsInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("metrics: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("metrics: invalid name")
    }
    return nil
}

func (v *MetricsValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("metrics: description too long") }
    return nil
}

func (v *MetricsValidator) ValidateType(typ string) error {
    if typ == "" { return ErrMetricsInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("metrics: unsupported type")
}

func (v *MetricsValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrMetricsInvalidInput }
    return nil
}

type MetricsValidationResult struct { Valid bool; Errors []string }

func (v *MetricsValidator) Validate(name, desc, typ, id string) *MetricsValidationResult {
    r := &MetricsValidationResult{}
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
