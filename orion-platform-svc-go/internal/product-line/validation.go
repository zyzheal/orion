package productline

import (
    "fmt"
    "regexp"
    "strings"
)

type ProductLineValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultProductLineValidator() *ProductLineValidator {
    return &ProductLineValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ProductLineValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrProductLineInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("product-line: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("product-line: invalid name")
    }
    return nil
}

func (v *ProductLineValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("product-line: description too long") }
    return nil
}

func (v *ProductLineValidator) ValidateType(typ string) error {
    if typ == "" { return ErrProductLineInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("product-line: unsupported type")
}

func (v *ProductLineValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrProductLineInvalidInput }
    return nil
}

type ProductLineValidationResult struct { Valid bool; Errors []string }

func (v *ProductLineValidator) Validate(name, desc, typ, id string) *ProductLineValidationResult {
    r := &ProductLineValidationResult{}
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
