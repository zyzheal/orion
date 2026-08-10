package multimodaltrigger

import (
    "fmt"
    "regexp"
    "strings"
)

type MultiModalTriggerValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultMultiModalTriggerValidator() *MultiModalTriggerValidator {
    return &MultiModalTriggerValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *MultiModalTriggerValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrMultiModalTriggerInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("multi-modal-trigger: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("multi-modal-trigger: invalid name")
    }
    return nil
}

func (v *MultiModalTriggerValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("multi-modal-trigger: description too long") }
    return nil
}

func (v *MultiModalTriggerValidator) ValidateType(typ string) error {
    if typ == "" { return ErrMultiModalTriggerInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("multi-modal-trigger: unsupported type")
}

func (v *MultiModalTriggerValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrMultiModalTriggerInvalidInput }
    return nil
}

type MultiModalTriggerValidationResult struct { Valid bool; Errors []string }

func (v *MultiModalTriggerValidator) Validate(name, desc, typ, id string) *MultiModalTriggerValidationResult {
    r := &MultiModalTriggerValidationResult{}
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
