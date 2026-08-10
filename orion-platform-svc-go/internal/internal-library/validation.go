package internallibrary

import (
    "fmt"
    "regexp"
    "strings"
)

type InternalLibraryValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultInternalLibraryValidator() *InternalLibraryValidator {
    return &InternalLibraryValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *InternalLibraryValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrInternalLibraryInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("internal-library: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("internal-library: invalid name characters")
    }
    return nil
}

func (v *InternalLibraryValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("internal-library: description too long") }
    return nil
}

func (v *InternalLibraryValidator) ValidateType(typ string) error {
    if typ == "" { return ErrInternalLibraryInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("internal-library: unsupported type")
}

func (v *InternalLibraryValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrInternalLibraryInvalidInput }
    return nil
}

type InternalLibraryValidationResult struct { Valid bool; Errors []string }

func (v *InternalLibraryValidator) Validate(name, desc, typ, id string) *InternalLibraryValidationResult {
    r := &InternalLibraryValidationResult{}
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
