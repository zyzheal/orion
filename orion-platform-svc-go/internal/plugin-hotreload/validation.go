package pluginhotreload

import (
    "fmt"
    "regexp"
    "strings"
)

type PluginHotreloadValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultPluginHotreloadValidator() *PluginHotreloadValidator {
    return &PluginHotreloadValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *PluginHotreloadValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrPluginHotreloadInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("plugin-hotreload: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("plugin-hotreload: invalid name")
    }
    return nil
}

func (v *PluginHotreloadValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("plugin-hotreload: description too long") }
    return nil
}

func (v *PluginHotreloadValidator) ValidateType(typ string) error {
    if typ == "" { return ErrPluginHotreloadInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("plugin-hotreload: unsupported type")
}

func (v *PluginHotreloadValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrPluginHotreloadInvalidInput }
    return nil
}

type PluginHotreloadValidationResult struct { Valid bool; Errors []string }

func (v *PluginHotreloadValidator) Validate(name, desc, typ, id string) *PluginHotreloadValidationResult {
    r := &PluginHotreloadValidationResult{}
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
