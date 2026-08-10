package knowledge

import (
    "fmt"
    "regexp"
    "strings"
)

type KnowledgeValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultKnowledgeValidator() *KnowledgeValidator {
    return &KnowledgeValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *KnowledgeValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrKnowledgeInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("knowledge: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("knowledge: invalid name characters")
    }
    return nil
}

func (v *KnowledgeValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("knowledge: description too long") }
    return nil
}

func (v *KnowledgeValidator) ValidateType(typ string) error {
    if typ == "" { return ErrKnowledgeInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("knowledge: unsupported type")
}

func (v *KnowledgeValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrKnowledgeInvalidInput }
    return nil
}

type KnowledgeValidationResult struct { Valid bool; Errors []string }

func (v *KnowledgeValidator) Validate(name, desc, typ, id string) *KnowledgeValidationResult {
    r := &KnowledgeValidationResult{}
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
