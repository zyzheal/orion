package sbom

import (
    "fmt"
    "regexp"
    "strings"
)

type SbomValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultSbomValidator() *SbomValidator {
    return &SbomValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *SbomValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrSbomInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("sbom: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("sbom: invalid name characters")
    }
    return nil
}

func (v *SbomValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("sbom: description too long") }
    return nil
}

func (v *SbomValidator) ValidateType(typ string) error {
    if typ == "" { return ErrSbomInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("sbom: unsupported type")
}

func (v *SbomValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrSbomInvalidInput }
    return nil
}

type SbomValidationResult struct { Valid bool; Errors []string }

func (v *SbomValidator) Validate(name, desc, typ, id string) *SbomValidationResult {
    r := &SbomValidationResult{}
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
