package supplychain

import (
    "fmt"
    "regexp"
    "strings"
)

type SupplyChainValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultSupplyChainValidator() *SupplyChainValidator {
    return &SupplyChainValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *SupplyChainValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrSupplyChainInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("supply-chain: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("supply-chain: invalid name")
    }
    return nil
}

func (v *SupplyChainValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("supply-chain: description too long") }
    return nil
}

func (v *SupplyChainValidator) ValidateType(typ string) error {
    if typ == "" { return ErrSupplyChainInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("supply-chain: unsupported type")
}

func (v *SupplyChainValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrSupplyChainInvalidInput }
    return nil
}

type SupplyChainValidationResult struct { Valid bool; Errors []string }

func (v *SupplyChainValidator) Validate(name, desc, typ, id string) *SupplyChainValidationResult {
    r := &SupplyChainValidationResult{}
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
