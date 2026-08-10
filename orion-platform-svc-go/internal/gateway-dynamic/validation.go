package gatewaydynamic

import (
    "fmt"
    "regexp"
    "strings"
)

type GatewayDynamicValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultGatewayDynamicValidator() *GatewayDynamicValidator {
    return &GatewayDynamicValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *GatewayDynamicValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrGatewayDynamicInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("gateway-dynamic: name exceeds max length") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("gateway-dynamic: invalid name characters")
    }
    return nil
}

func (v *GatewayDynamicValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("gateway-dynamic: description too long") }
    return nil
}

func (v *GatewayDynamicValidator) ValidateType(typ string) error {
    if typ == "" { return ErrGatewayDynamicInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("gateway-dynamic: unsupported type")
}

func (v *GatewayDynamicValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrGatewayDynamicInvalidInput }
    return nil
}

type GatewayDynamicValidationResult struct { Valid bool; Errors []string }

func (v *GatewayDynamicValidator) Validate(name, desc, typ, id string) *GatewayDynamicValidationResult {
    r := &GatewayDynamicValidationResult{}
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
