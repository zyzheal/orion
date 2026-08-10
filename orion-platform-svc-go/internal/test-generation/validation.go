package testgeneration

import (
    "fmt"
    "regexp"
    "strings"
)

type TestGenerationValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultTestGenerationValidator() *TestGenerationValidator {
    return &TestGenerationValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *TestGenerationValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrTestGenerationInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("test-generation: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("test-generation: invalid name")
    }
    return nil
}

func (v *TestGenerationValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("test-generation: description too long") }
    return nil
}

func (v *TestGenerationValidator) ValidateType(typ string) error {
    if typ == "" { return ErrTestGenerationInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("test-generation: unsupported type")
}

func (v *TestGenerationValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrTestGenerationInvalidInput }
    return nil
}

type TestGenerationValidationResult struct { Valid bool; Errors []string }

func (v *TestGenerationValidator) Validate(name, desc, typ, id string) *TestGenerationValidationResult {
    r := &TestGenerationValidationResult{}
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
