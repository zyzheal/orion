package metadata

import (
    "fmt"
    "regexp"
    "strings"
)

type MetadataValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultMetadataValidator() *MetadataValidator {
    return &MetadataValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *MetadataValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrMetadataInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("metadata: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("metadata: invalid name")
    }
    return nil
}

func (v *MetadataValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("metadata: description too long") }
    return nil
}

func (v *MetadataValidator) ValidateType(typ string) error {
    if typ == "" { return ErrMetadataInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("metadata: unsupported type")
}

func (v *MetadataValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrMetadataInvalidInput }
    return nil
}

type MetadataValidationResult struct { Valid bool; Errors []string }

func (v *MetadataValidator) Validate(name, desc, typ, id string) *MetadataValidationResult {
    r := &MetadataValidationResult{}
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
