package handler

import (
    "fmt"
    "regexp"
    "strings"
)

type SemanticSearchValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultSemanticSearchValidator() *SemanticSearchValidator {
    return &SemanticSearchValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *SemanticSearchValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrSemanticSearchInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("semantic-search: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("semantic-search: invalid name")
    }
    return nil
}

func (v *SemanticSearchValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("semantic-search: description too long") }
    return nil
}

func (v *SemanticSearchValidator) ValidateType(typ string) error {
    if typ == "" { return ErrSemanticSearchInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("semantic-search: unsupported type")
}

func (v *SemanticSearchValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrSemanticSearchInvalidInput }
    return nil
}

type SemanticSearchValidationResult struct { Valid bool; Errors []string }

func (v *SemanticSearchValidator) Validate(name, desc, typ, id string) *SemanticSearchValidationResult {
    r := &SemanticSearchValidationResult{}
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
