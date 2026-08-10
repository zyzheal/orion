package selfservice

import (
    "fmt"
    "regexp"
    "strings"
)

type SelfServiceValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultSelfServiceValidator() *SelfServiceValidator {
    return &SelfServiceValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *SelfServiceValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrSelfServiceInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("self-service: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("self-service: invalid name")
    }
    return nil
}

func (v *SelfServiceValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("self-service: description too long") }
    return nil
}

func (v *SelfServiceValidator) ValidateType(typ string) error {
    if typ == "" { return ErrSelfServiceInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("self-service: unsupported type")
}

func (v *SelfServiceValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrSelfServiceInvalidInput }
    return nil
}

type SelfServiceValidationResult struct { Valid bool; Errors []string }

func (v *SelfServiceValidator) Validate(name, desc, typ, id string) *SelfServiceValidationResult {
    r := &SelfServiceValidationResult{}
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
