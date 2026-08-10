package datacatalog

import (
    "fmt"
    "regexp"
    "strings"
)

type DataCatalogValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultDataCatalogValidator() *DataCatalogValidator {
    return &DataCatalogValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *DataCatalogValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrDataCatalogInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("data-catalog: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("data-catalog: invalid name characters")
    }
    return nil
}

func (v *DataCatalogValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("data-catalog: description too long") }
    return nil
}

func (v *DataCatalogValidator) ValidateType(typ string) error {
    if typ == "" { return ErrDataCatalogInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("data-catalog: unsupported type")
}

func (v *DataCatalogValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrDataCatalogInvalidInput }
    return nil
}

type DataCatalogValidationResult struct { Valid bool; Errors []string }

func (v *DataCatalogValidator) Validate(name, desc, typ, id string) *DataCatalogValidationResult {
    r := &DataCatalogValidationResult{}
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
