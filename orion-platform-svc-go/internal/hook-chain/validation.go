package hookchain

import (
    "fmt"
    "regexp"
    "strings"
)

type HookChainValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultHookChainValidator() *HookChainValidator {
    return &HookChainValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *HookChainValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrHookChainInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("hook-chain: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("hook-chain: invalid name")
    }
    return nil
}

func (v *HookChainValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("hook-chain: description too long") }
    return nil
}

func (v *HookChainValidator) ValidateType(typ string) error {
    if typ == "" { return ErrHookChainInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("hook-chain: unsupported type")
}

func (v *HookChainValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrHookChainInvalidInput }
    return nil
}

type HookChainValidationResult struct { Valid bool; Errors []string }

func (v *HookChainValidator) Validate(name, desc, typ, id string) *HookChainValidationResult {
    r := &HookChainValidationResult{}
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
