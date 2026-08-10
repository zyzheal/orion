package chaosgateway

import (
    "fmt"
    "regexp"
    "strings"
)

type ChaosGatewayValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultChaosGatewayValidator() *ChaosGatewayValidator {
    return &ChaosGatewayValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ChaosGatewayValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrChaosGatewayInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("chaos-gateway: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("chaos-gateway: invalid name characters")
    }
    return nil
}

func (v *ChaosGatewayValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("chaos-gateway: description too long") }
    return nil
}

func (v *ChaosGatewayValidator) ValidateType(typ string) error {
    if typ == "" { return ErrChaosGatewayInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("chaos-gateway: unsupported type")
}

func (v *ChaosGatewayValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrChaosGatewayInvalidInput }
    return nil
}

type ChaosGatewayValidationResult struct { Valid bool; Errors []string }

func (v *ChaosGatewayValidator) Validate(name, desc, typ, id string) *ChaosGatewayValidationResult {
    r := &ChaosGatewayValidationResult{}
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
