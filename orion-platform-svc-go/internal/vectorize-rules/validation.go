package vectorizerules

import (
    "fmt"
    "regexp"
    "strings"
)

type VectorizeRulesValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultVectorizeRulesValidator() *VectorizeRulesValidator {
    return &VectorizeRulesValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *VectorizeRulesValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrVectorizeRulesInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("vectorize-rules: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("vectorize-rules: invalid name")
    }
    return nil
}

func (v *VectorizeRulesValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("vectorize-rules: description too long") }
    return nil
}

func (v *VectorizeRulesValidator) ValidateType(typ string) error {
    if typ == "" { return ErrVectorizeRulesInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("vectorize-rules: unsupported type")
}

func (v *VectorizeRulesValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrVectorizeRulesInvalidInput }
    return nil
}

type VectorizeRulesValidationResult struct { Valid bool; Errors []string }

func (v *VectorizeRulesValidator) Validate(name, desc, typ, id string) *VectorizeRulesValidationResult {
    r := &VectorizeRulesValidationResult{}
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
