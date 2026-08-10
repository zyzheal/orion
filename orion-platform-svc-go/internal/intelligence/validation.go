package intelligence

import (
    "fmt"
    "regexp"
    "strings"
)

type IntelligenceValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultIntelligenceValidator() *IntelligenceValidator {
    return &IntelligenceValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *IntelligenceValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrIntelligenceInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("intelligence: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("intelligence: invalid name")
    }
    return nil
}

func (v *IntelligenceValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("intelligence: description too long") }
    return nil
}

func (v *IntelligenceValidator) ValidateType(typ string) error {
    if typ == "" { return ErrIntelligenceInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("intelligence: unsupported type")
}

func (v *IntelligenceValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrIntelligenceInvalidInput }
    return nil
}

type IntelligenceValidationResult struct { Valid bool; Errors []string }

func (v *IntelligenceValidator) Validate(name, desc, typ, id string) *IntelligenceValidationResult {
    r := &IntelligenceValidationResult{}
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
