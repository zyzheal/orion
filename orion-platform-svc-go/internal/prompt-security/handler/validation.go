package handler

import (
    "fmt"
    "regexp"
    "strings"
)

type PromptSecurityValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultPromptSecurityValidator() *PromptSecurityValidator {
    return &PromptSecurityValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *PromptSecurityValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrPromptSecurityInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("prompt-security: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("prompt-security: invalid name")
    }
    return nil
}

func (v *PromptSecurityValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("prompt-security: description too long") }
    return nil
}

func (v *PromptSecurityValidator) ValidateType(typ string) error {
    if typ == "" { return ErrPromptSecurityInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("prompt-security: unsupported type")
}

func (v *PromptSecurityValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrPromptSecurityInvalidInput }
    return nil
}

type PromptSecurityValidationResult struct { Valid bool; Errors []string }

func (v *PromptSecurityValidator) Validate(name, desc, typ, id string) *PromptSecurityValidationResult {
    r := &PromptSecurityValidationResult{}
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
