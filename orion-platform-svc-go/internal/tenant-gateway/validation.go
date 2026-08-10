package tenantgateway

import (
    "fmt"
    "regexp"
    "strings"
)

type TenantGatewayValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultTenantGatewayValidator() *TenantGatewayValidator {
    return &TenantGatewayValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *TenantGatewayValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrTenantGatewayInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("tenant-gateway: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("tenant-gateway: invalid name")
    }
    return nil
}

func (v *TenantGatewayValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("tenant-gateway: description too long") }
    return nil
}

func (v *TenantGatewayValidator) ValidateType(typ string) error {
    if typ == "" { return ErrTenantGatewayInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("tenant-gateway: unsupported type")
}

func (v *TenantGatewayValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrTenantGatewayInvalidInput }
    return nil
}

type TenantGatewayValidationResult struct { Valid bool; Errors []string }

func (v *TenantGatewayValidator) Validate(name, desc, typ, id string) *TenantGatewayValidationResult {
    r := &TenantGatewayValidationResult{}
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
