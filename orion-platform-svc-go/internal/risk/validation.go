package risk

import (
    "fmt"
    "regexp"
    "strings"
)

type RiskValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultRiskValidator() *RiskValidator {
    return &RiskValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *RiskValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrRiskInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("risk: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("risk: invalid name")
    }
    return nil
}

func (v *RiskValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("risk: description too long") }
    return nil
}

func (v *RiskValidator) ValidateType(typ string) error {
    if typ == "" { return ErrRiskInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("risk: unsupported type")
}

func (v *RiskValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrRiskInvalidInput }
    return nil
}

type RiskValidationResult struct { Valid bool; Errors []string }

func (v *RiskValidator) Validate(name, desc, typ, id string) *RiskValidationResult {
    r := &RiskValidationResult{}
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
