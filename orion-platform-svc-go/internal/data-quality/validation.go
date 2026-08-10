package dataquality

import (
    "fmt"
    "regexp"
    "strings"
)

type DataQualityValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultDataQualityValidator() *DataQualityValidator {
    return &DataQualityValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *DataQualityValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrDataQualityInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("data-quality: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("data-quality: invalid name characters")
    }
    return nil
}

func (v *DataQualityValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("data-quality: description too long") }
    return nil
}

func (v *DataQualityValidator) ValidateType(typ string) error {
    if typ == "" { return ErrDataQualityInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("data-quality: unsupported type")
}

func (v *DataQualityValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrDataQualityInvalidInput }
    return nil
}

type DataQualityValidationResult struct { Valid bool; Errors []string }

func (v *DataQualityValidator) Validate(name, desc, typ, id string) *DataQualityValidationResult {
    r := &DataQualityValidationResult{}
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
