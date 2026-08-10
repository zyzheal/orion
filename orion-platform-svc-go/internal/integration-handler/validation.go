package integrationhandler

import (
    "fmt"
    "regexp"
    "strings"
)

type IntegrationHandlerValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultIntegrationHandlerValidator() *IntegrationHandlerValidator {
    return &IntegrationHandlerValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *IntegrationHandlerValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrIntegrationHandlerInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("integration-handler: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("integration-handler: invalid name")
    }
    return nil
}

func (v *IntegrationHandlerValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("integration-handler: description too long") }
    return nil
}

func (v *IntegrationHandlerValidator) ValidateType(typ string) error {
    if typ == "" { return ErrIntegrationHandlerInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("integration-handler: unsupported type")
}

func (v *IntegrationHandlerValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrIntegrationHandlerInvalidInput }
    return nil
}

type IntegrationHandlerValidationResult struct { Valid bool; Errors []string }

func (v *IntegrationHandlerValidator) Validate(name, desc, typ, id string) *IntegrationHandlerValidationResult {
    r := &IntegrationHandlerValidationResult{}
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
