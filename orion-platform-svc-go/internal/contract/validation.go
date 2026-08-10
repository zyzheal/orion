package contract

import (
    "fmt"
    "regexp"
    "strings"
)

type ContractValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultContractValidator() *ContractValidator {
    return &ContractValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ContractValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrContractInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("contract: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("contract: invalid name")
    }
    return nil
}

func (v *ContractValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("contract: description too long") }
    return nil
}

func (v *ContractValidator) ValidateType(typ string) error {
    if typ == "" { return ErrContractInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("contract: unsupported type")
}

func (v *ContractValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrContractInvalidInput }
    return nil
}

type ContractValidationResult struct { Valid bool; Errors []string }

func (v *ContractValidator) Validate(name, desc, typ, id string) *ContractValidationResult {
    r := &ContractValidationResult{}
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
