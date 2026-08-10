package globalsearch

import (
    "fmt"
    "regexp"
    "strings"
)

type GlobalSearchValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultGlobalSearchValidator() *GlobalSearchValidator {
    return &GlobalSearchValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *GlobalSearchValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrGlobalSearchInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("global-search: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("global-search: invalid name")
    }
    return nil
}

func (v *GlobalSearchValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("global-search: description too long") }
    return nil
}

func (v *GlobalSearchValidator) ValidateType(typ string) error {
    if typ == "" { return ErrGlobalSearchInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("global-search: unsupported type")
}

func (v *GlobalSearchValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrGlobalSearchInvalidInput }
    return nil
}

type GlobalSearchValidationResult struct { Valid bool; Errors []string }

func (v *GlobalSearchValidator) Validate(name, desc, typ, id string) *GlobalSearchValidationResult {
    r := &GlobalSearchValidationResult{}
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
