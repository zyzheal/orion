package datalineage

import (
    "fmt"
    "regexp"
    "strings"
)

type DataLineageValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultDataLineageValidator() *DataLineageValidator {
    return &DataLineageValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *DataLineageValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrDataLineageInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("data-lineage: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("data-lineage: invalid name")
    }
    return nil
}

func (v *DataLineageValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("data-lineage: description too long") }
    return nil
}

func (v *DataLineageValidator) ValidateType(typ string) error {
    if typ == "" { return ErrDataLineageInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("data-lineage: unsupported type")
}

func (v *DataLineageValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrDataLineageInvalidInput }
    return nil
}

type DataLineageValidationResult struct { Valid bool; Errors []string }

func (v *DataLineageValidator) Validate(name, desc, typ, id string) *DataLineageValidationResult {
    r := &DataLineageValidationResult{}
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
