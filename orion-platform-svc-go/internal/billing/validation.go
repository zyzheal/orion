package billing

import (
    "fmt"
    "regexp"
    "strings"
)

type BillingValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultBillingValidator() *BillingValidator {
    return &BillingValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *BillingValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrBillingInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("billing: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("billing: invalid name characters")
    }
    return nil
}

func (v *BillingValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("billing: description too long") }
    return nil
}

func (v *BillingValidator) ValidateType(typ string) error {
    if typ == "" { return ErrBillingInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("billing: unsupported type")
}

func (v *BillingValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrBillingInvalidInput }
    return nil
}

type BillingValidationResult struct { Valid bool; Errors []string }

func (v *BillingValidator) Validate(name, desc, typ, id string) *BillingValidationResult {
    r := &BillingValidationResult{}
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
