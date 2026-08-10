package serverless

import (
    "fmt"
    "regexp"
    "strings"
)

type ServerlessValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultServerlessValidator() *ServerlessValidator {
    return &ServerlessValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ServerlessValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrServerlessInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("serverless: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("serverless: invalid name characters")
    }
    return nil
}

func (v *ServerlessValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("serverless: description too long") }
    return nil
}

func (v *ServerlessValidator) ValidateType(typ string) error {
    if typ == "" { return ErrServerlessInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("serverless: unsupported type")
}

func (v *ServerlessValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrServerlessInvalidInput }
    return nil
}

type ServerlessValidationResult struct { Valid bool; Errors []string }

func (v *ServerlessValidator) Validate(name, desc, typ, id string) *ServerlessValidationResult {
    r := &ServerlessValidationResult{}
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
