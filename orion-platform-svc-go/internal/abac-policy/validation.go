package abacpolicy

import (
    "fmt"
    "regexp"
    "strings"
)

type AbacPolicyValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultAbacPolicyValidator() *AbacPolicyValidator {
    return &AbacPolicyValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *AbacPolicyValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrAbacPolicyInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("abac-policy: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("abac-policy: invalid name")
    }
    return nil
}

func (v *AbacPolicyValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("abac-policy: description too long") }
    return nil
}

func (v *AbacPolicyValidator) ValidateType(typ string) error {
    if typ == "" { return ErrAbacPolicyInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("abac-policy: unsupported type")
}

func (v *AbacPolicyValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrAbacPolicyInvalidInput }
    return nil
}

type AbacPolicyValidationResult struct { Valid bool; Errors []string }

func (v *AbacPolicyValidator) Validate(name, desc, typ, id string) *AbacPolicyValidationResult {
    r := &AbacPolicyValidationResult{}
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
