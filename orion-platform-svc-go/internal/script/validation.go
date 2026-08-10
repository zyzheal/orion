package script

import (
    "fmt"
    "regexp"
    "strings"
)

type ScriptValidator struct {
    MaxNameLength int
    MaxDescLength int
    AllowedTypes  []string
}

func DefaultScriptValidator() *ScriptValidator {
    return &ScriptValidator{MaxNameLength: 256, MaxDescLength: 2048}
}

func (v *ScriptValidator) ValidateName(name string) error {
    if strings.TrimSpace(name) == "" { return ErrScriptInvalidInput }
    if len(name) > v.MaxNameLength { return fmt.Errorf("script: name too long") }
    if !regexp.MustCompile(`^[a-zA-Z0-9_\-:\./]+$`).MatchString(name) {
        return fmt.Errorf("script: invalid name")
    }
    return nil
}

func (v *ScriptValidator) ValidateDescription(desc string) error {
    if len(desc) > v.MaxDescLength { return fmt.Errorf("script: description too long") }
    return nil
}

func (v *ScriptValidator) ValidateType(typ string) error {
    if typ == "" { return ErrScriptInvalidInput }
    if len(v.AllowedTypes) == 0 { return nil }
    for _, a := range v.AllowedTypes { if typ == a { return nil } }
    return fmt.Errorf("script: unsupported type")
}

func (v *ScriptValidator) ValidateID(id string) error {
    if strings.TrimSpace(id) == "" { return ErrScriptInvalidInput }
    return nil
}

type ScriptValidationResult struct { Valid bool; Errors []string }

func (v *ScriptValidator) Validate(name, desc, typ, id string) *ScriptValidationResult {
    r := &ScriptValidationResult{}
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
