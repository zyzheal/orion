package handler

import (
    "fmt"
    "regexp"
    "strings"
)

type CmdbDriftValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultCmdbDriftValidator() *CmdbDriftValidator {
    return &CmdbDriftValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *CmdbDriftValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrCmdbDriftInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("cmdb-drift: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("cmdb-drift: invalid name")
    }
    return nil
}

func (v *CmdbDriftValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("cmdb-drift: description too long") }
    return nil
}

func (v *CmdbDriftValidator) ValidateType(typ string) error {
    if typ == "" { return ErrCmdbDriftInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("cmdb-drift: unsupported type")
}

func (v *CmdbDriftValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrCmdbDriftInvalidInput }
    return nil
}

type CmdbDriftValidationResult struct { Valid bool; Errors []string }

func (v *CmdbDriftValidator) Validate(name, desc, typ, id string) *CmdbDriftValidationResult {
    r := &CmdbDriftValidationResult{}
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
