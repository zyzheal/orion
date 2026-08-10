package pluginmarketplace

import (
    "fmt"
    "regexp"
    "strings"
)

type PluginMarketplaceValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultPluginMarketplaceValidator() *PluginMarketplaceValidator {
    return &PluginMarketplaceValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *PluginMarketplaceValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrPluginMarketplaceInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("plugin-marketplace: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("plugin-marketplace: invalid name")
    }
    return nil
}

func (v *PluginMarketplaceValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("plugin-marketplace: description too long") }
    return nil
}

func (v *PluginMarketplaceValidator) ValidateType(typ string) error {
    if typ == "" { return ErrPluginMarketplaceInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("plugin-marketplace: unsupported type")
}

func (v *PluginMarketplaceValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrPluginMarketplaceInvalidInput }
    return nil
}

type PluginMarketplaceValidationResult struct { Valid bool; Errors []string }

func (v *PluginMarketplaceValidator) Validate(name, desc, typ, id string) *PluginMarketplaceValidationResult {
    r := &PluginMarketplaceValidationResult{}
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
