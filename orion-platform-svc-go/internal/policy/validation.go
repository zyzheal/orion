package policy

import (
    "fmt"
    "regexp"
    "strings"
)

type PolicyValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultPolicyValidator() *PolicyValidator {
    return &PolicyValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *PolicyValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrPolicyInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("policy: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("policy: invalid name characters")
    }
    return nil
}

func (v *PolicyValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("policy: description too long") }
    return nil
}

func (v *PolicyValidator) ValidateType(typ string) error {
    if typ == "" { return ErrPolicyInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("policy: unsupported type")
}

func (v *PolicyValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrPolicyInvalidInput }
    return nil
}

type PolicyValidationResult struct { Valid bool; Errors []string }

func (v *PolicyValidator) Validate(name, desc, typ, id string) *PolicyValidationResult {
    r := &PolicyValidationResult{}
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
