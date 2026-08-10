package canaryanalysis

import (
    "fmt"
    "regexp"
    "strings"
)

type CanaryAnalysisValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultCanaryAnalysisValidator() *CanaryAnalysisValidator {
    return &CanaryAnalysisValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *CanaryAnalysisValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrCanaryAnalysisInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("canary-analysis: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("canary-analysis: invalid name")
    }
    return nil
}

func (v *CanaryAnalysisValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("canary-analysis: description too long") }
    return nil
}

func (v *CanaryAnalysisValidator) ValidateType(typ string) error {
    if typ == "" { return ErrCanaryAnalysisInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("canary-analysis: unsupported type")
}

func (v *CanaryAnalysisValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrCanaryAnalysisInvalidInput }
    return nil
}

type CanaryAnalysisValidationResult struct { Valid bool; Errors []string }

func (v *CanaryAnalysisValidator) Validate(name, desc, typ, id string) *CanaryAnalysisValidationResult {
    r := &CanaryAnalysisValidationResult{}
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
