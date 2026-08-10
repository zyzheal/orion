package versionarchive

import (
    "fmt"
    "regexp"
    "strings"
)

type VersionArchiveValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultVersionArchiveValidator() *VersionArchiveValidator {
    return &VersionArchiveValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *VersionArchiveValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrVersionArchiveInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("version-archive: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("version-archive: invalid name")
    }
    return nil
}

func (v *VersionArchiveValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("version-archive: description too long") }
    return nil
}

func (v *VersionArchiveValidator) ValidateType(typ string) error {
    if typ == "" { return ErrVersionArchiveInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("version-archive: unsupported type")
}

func (v *VersionArchiveValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrVersionArchiveInvalidInput }
    return nil
}

type VersionArchiveValidationResult struct { Valid bool; Errors []string }

func (v *VersionArchiveValidator) Validate(name, desc, typ, id string) *VersionArchiveValidationResult {
    r := &VersionArchiveValidationResult{}
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
