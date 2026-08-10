package handler

import (
    "fmt"
    "regexp"
    "strings"
)

type CodeEmbeddingValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultCodeEmbeddingValidator() *CodeEmbeddingValidator {
    return &CodeEmbeddingValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *CodeEmbeddingValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrCodeEmbeddingInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("code-embedding: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("code-embedding: invalid name")
    }
    return nil
}

func (v *CodeEmbeddingValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("code-embedding: description too long") }
    return nil
}

func (v *CodeEmbeddingValidator) ValidateType(typ string) error {
    if typ == "" { return ErrCodeEmbeddingInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("code-embedding: unsupported type")
}

func (v *CodeEmbeddingValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrCodeEmbeddingInvalidInput }
    return nil
}

type CodeEmbeddingValidationResult struct { Valid bool; Errors []string }

func (v *CodeEmbeddingValidator) Validate(name, desc, typ, id string) *CodeEmbeddingValidationResult {
    r := &CodeEmbeddingValidationResult{}
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
