package middleware

import (
    "fmt"
    "regexp"
    "strings"
)

type MiddlewareValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultMiddlewareValidator() *MiddlewareValidator {
    return &MiddlewareValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *MiddlewareValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrMiddlewareInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("middleware: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("middleware: invalid name")
    }
    return nil
}

func (v *MiddlewareValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("middleware: description too long") }
    return nil
}

func (v *MiddlewareValidator) ValidateType(typ string) error {
    if typ == "" { return ErrMiddlewareInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("middleware: unsupported type")
}

func (v *MiddlewareValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrMiddlewareInvalidInput }
    return nil
}

type MiddlewareValidationResult struct { Valid bool; Errors []string }

func (v *MiddlewareValidator) Validate(name, desc, typ, id string) *MiddlewareValidationResult {
    r := &MiddlewareValidationResult{}
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
