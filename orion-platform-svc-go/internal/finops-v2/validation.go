package finopsv2

import (
    "fmt"
    "regexp"
    "strings"
)

type FinopsV2Validator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultFinopsV2Validator() *FinopsV2Validator {
    return &FinopsV2Validator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *FinopsV2Validator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrFinopsV2InvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("finops-v2: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("finops-v2: invalid name characters")
    }
    return nil
}

func (v *FinopsV2Validator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("finops-v2: description too long") }
    return nil
}

func (v *FinopsV2Validator) ValidateType(typ string) error {
    if typ == "" { return ErrFinopsV2InvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("finops-v2: unsupported type")
}

func (v *FinopsV2Validator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrFinopsV2InvalidInput }
    return nil
}

type FinopsV2ValidationResult struct { Valid bool; Errors []string }

func (v *FinopsV2Validator) Validate(name, desc, typ, id string) *FinopsV2ValidationResult {
    r := &FinopsV2ValidationResult{}
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
