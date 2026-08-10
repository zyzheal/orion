package pageregistry

import (
    "fmt"
    "regexp"
    "strings"
)

type PageRegistryValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultPageRegistryValidator() *PageRegistryValidator {
    return &PageRegistryValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *PageRegistryValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrPageRegistryInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("page-registry: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("page-registry: invalid name")
    }
    return nil
}

func (v *PageRegistryValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("page-registry: description too long") }
    return nil
}

func (v *PageRegistryValidator) ValidateType(typ string) error {
    if typ == "" { return ErrPageRegistryInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("page-registry: unsupported type")
}

func (v *PageRegistryValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrPageRegistryInvalidInput }
    return nil
}

type PageRegistryValidationResult struct { Valid bool; Errors []string }

func (v *PageRegistryValidator) Validate(name, desc, typ, id string) *PageRegistryValidationResult {
    r := &PageRegistryValidationResult{}
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
