package costallocation

import (
    "fmt"
    "regexp"
    "strings"
)

type CostAllocationValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultCostAllocationValidator() *CostAllocationValidator {
    return &CostAllocationValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *CostAllocationValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrCostAllocationInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("cost-allocation: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("cost-allocation: invalid name")
    }
    return nil
}

func (v *CostAllocationValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("cost-allocation: description too long") }
    return nil
}

func (v *CostAllocationValidator) ValidateType(typ string) error {
    if typ == "" { return ErrCostAllocationInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("cost-allocation: unsupported type")
}

func (v *CostAllocationValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrCostAllocationInvalidInput }
    return nil
}

type CostAllocationValidationResult struct { Valid bool; Errors []string }

func (v *CostAllocationValidator) Validate(name, desc, typ, id string) *CostAllocationValidationResult {
    r := &CostAllocationValidationResult{}
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
