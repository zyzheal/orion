package resiliencescore

import (
    "fmt"
    "regexp"
    "strings"
)

type ResilienceScoreValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultResilienceScoreValidator() *ResilienceScoreValidator {
    return &ResilienceScoreValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ResilienceScoreValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrResilienceScoreInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("resilience-score: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("resilience-score: invalid name characters")
    }
    return nil
}

func (v *ResilienceScoreValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("resilience-score: description too long") }
    return nil
}

func (v *ResilienceScoreValidator) ValidateType(typ string) error {
    if typ == "" { return ErrResilienceScoreInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("resilience-score: unsupported type")
}

func (v *ResilienceScoreValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrResilienceScoreInvalidInput }
    return nil
}

type ResilienceScoreValidationResult struct { Valid bool; Errors []string }

func (v *ResilienceScoreValidator) Validate(name, desc, typ, id string) *ResilienceScoreValidationResult {
    r := &ResilienceScoreValidationResult{}
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
