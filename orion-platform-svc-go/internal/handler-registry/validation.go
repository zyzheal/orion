package handlerregistry

import (
    "fmt"
    "regexp"
    "strings"
)

type HandlerRegistryValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultHandlerRegistryValidator() *HandlerRegistryValidator {
    return &HandlerRegistryValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *HandlerRegistryValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrHandlerRegistryInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("handler-registry: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("handler-registry: invalid name")
    }
    return nil
}

func (v *HandlerRegistryValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("handler-registry: description too long") }
    return nil
}

func (v *HandlerRegistryValidator) ValidateType(typ string) error {
    if typ == "" { return ErrHandlerRegistryInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("handler-registry: unsupported type")
}

func (v *HandlerRegistryValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrHandlerRegistryInvalidInput }
    return nil
}

type HandlerRegistryValidationResult struct { Valid bool; Errors []string }

func (v *HandlerRegistryValidator) Validate(name, desc, typ, id string) *HandlerRegistryValidationResult {
    r := &HandlerRegistryValidationResult{}
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
