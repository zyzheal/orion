package handler

import (
    "fmt"
    "regexp"
    "strings"
)

type RuleEngineValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultRuleEngineValidator() *RuleEngineValidator {
    return &RuleEngineValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *RuleEngineValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrRuleEngineInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("rule-engine: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("rule-engine: invalid name")
    }
    return nil
}

func (v *RuleEngineValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("rule-engine: description too long") }
    return nil
}

func (v *RuleEngineValidator) ValidateType(typ string) error {
    if typ == "" { return ErrRuleEngineInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("rule-engine: unsupported type")
}

func (v *RuleEngineValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrRuleEngineInvalidInput }
    return nil
}

type RuleEngineValidationResult struct { Valid bool; Errors []string }

func (v *RuleEngineValidator) Validate(name, desc, typ, id string) *RuleEngineValidationResult {
    r := &RuleEngineValidationResult{}
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
