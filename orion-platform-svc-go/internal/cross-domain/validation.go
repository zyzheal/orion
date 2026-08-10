package crossdomain

import (
    "fmt"
    "regexp"
    "strings"
)

type CrossDomainValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultCrossDomainValidator() *CrossDomainValidator {
    return &CrossDomainValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *CrossDomainValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrCrossDomainInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("cross-domain: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("cross-domain: invalid name")
    }
    return nil
}

func (v *CrossDomainValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("cross-domain: description too long") }
    return nil
}

func (v *CrossDomainValidator) ValidateType(typ string) error {
    if typ == "" { return ErrCrossDomainInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("cross-domain: unsupported type")
}

func (v *CrossDomainValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrCrossDomainInvalidInput }
    return nil
}

type CrossDomainValidationResult struct { Valid bool; Errors []string }

func (v *CrossDomainValidator) Validate(name, desc, typ, id string) *CrossDomainValidationResult {
    r := &CrossDomainValidationResult{}
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
